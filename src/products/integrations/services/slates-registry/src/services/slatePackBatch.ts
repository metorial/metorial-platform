import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { SlatePackImport } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { normalizeUpstreamUrl } from '../lib/mirror/upstreams';
import { computeWatermark, findMissingSequences } from '../lib/slatePack/delivery';
import { isMirrorMode } from '../mode';
import { storage } from '../storage';
import { LICENSE_UPSTREAM_IDENTIFIER } from './mirror';

let maxBatchFiles = 200;

let maxMissingSequences = 50;

let abandonedBatchMs = 24 * 60 * 60 * 1000;

export type PackChannelKey = { channelUrl: string; subRegistryId: string };

type SlatePackBatchIssueType =
  | 'failed'
  | 'unverified'
  | 'untracked'
  | 'foreign_channel'
  | 'rejected_versions'
  | 'incomplete_full_sync'
  | 'missing_sequences';

export type SlatePackBatchIssue = {
  type: SlatePackBatchIssueType;
  severity: 'error' | 'warning';
  message: string;
  packImportId: string | null;
};

let issueSeverity: Record<SlatePackBatchIssueType, SlatePackBatchIssue['severity']> = {
  failed: 'error',
  unverified: 'error',
  rejected_versions: 'error',
  untracked: 'warning',
  foreign_channel: 'warning',
  incomplete_full_sync: 'warning',
  missing_sequences: 'warning'
};

type TrackedImport = Pick<
  SlatePackImport,
  'kind' | 'sequence' | 'fullSyncId' | 'part' | 'partCount' | 'coversSequence'
>;

export let normalizePackChannelUrl = (url: string) => {
  try {
    return normalizeUpstreamUrl(url);
  } catch {
    return null;
  }
};

let isSameChannel = (a: PackChannelKey | null, b: PackChannelKey | null) =>
  !!a && !!b && a.channelUrl === b.channelUrl && a.subRegistryId === b.subRegistryId;

let describeImport = (packImport: SlatePackImport) =>
  packImport.kind === 'incremental'
    ? `pack #${packImport.sequence}`
    : packImport.kind === 'full'
      ? `full sync part ${packImport.part} of ${packImport.partCount}`
      : packImport.fileName;

let formatSequences = (sequences: number[]) =>
  sequences.map(sequence => `#${sequence}`).join(', ');

// Only imports that verified and lost nothing may move the watermark: a pack with rejected
// versions can be uploaded again once the license brings the missing trusted keys.
let watermarkEligibleWhere = (channel: PackChannelKey) => ({
  channelUrl: channel.channelUrl,
  channelSubRegistryId: channel.subRegistryId,
  manifestVerified: true,
  status: 'completed' as const,
  rejectedCount: 0
});

let getCompleteFullSyncs = (imports: TrackedImport[]) => {
  let parts = new Map<
    string,
    { partCount: number; coversSequence: number; parts: Set<number> }
  >();

  for (let packImport of imports) {
    if (packImport.kind !== 'full' || !packImport.fullSyncId) continue;

    let group = parts.get(packImport.fullSyncId) ?? {
      partCount: packImport.partCount ?? 0,
      coversSequence: packImport.coversSequence ?? 0,
      parts: new Set<number>()
    };
    if (packImport.part) group.parts.add(packImport.part);
    parts.set(packImport.fullSyncId, group);
  }

  return [...parts.values()].filter(group => group.parts.size >= group.partCount);
};

let batchInclude = {
  imports: { orderBy: [{ fileName: 'asc' as const }, { createdAt: 'asc' as const }] }
};

let findBatch = async (d: { id: string }) => {
  let batch = await db.slatePackImportBatch.findFirst({
    where: { id: d.id },
    include: batchInclude
  });
  if (!batch) throw new ServiceError(notFoundError('mirror.pack_import_batch'));

  return batch;
};

export type SlatePackBatchWithImports = Awaited<ReturnType<typeof findBatch>>;

class slatePackBatchServiceImpl {
  async createBatch(d: { fileCount: number }) {
    if (!isMirrorMode()) {
      throw new ServiceError(
        badRequestError({ message: 'Slate packs can only be imported in mirror mode.' })
      );
    }
    if (!Number.isInteger(d.fileCount) || d.fileCount < 1 || d.fileCount > maxBatchFiles) {
      throw new ServiceError(
        badRequestError({
          message: `Upload between 1 and ${maxBatchFiles} slate packs at once.`
        })
      );
    }

    return db.slatePackImportBatch.create({
      data: {
        ...getId('slatePackImportBatch'),
        status: 'uploading',
        expectedFileCount: d.fileCount
      }
    });
  }

  async getBatch(d: { id: string }) {
    return findBatch(d);
  }

  async listBatches() {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slatePackImportBatch.findMany({ ...opts, include: batchInclude })
      )
    );
  }

  async getUploadingBatch(d: { id: string }) {
    let batch = await db.slatePackImportBatch.findFirst({
      where: { id: d.id },
      include: { _count: { select: { imports: true } } }
    });
    if (!batch) throw new ServiceError(notFoundError('mirror.pack_import_batch'));

    if (batch.status !== 'uploading') {
      throw new ServiceError(
        badRequestError({ message: 'This upload batch no longer accepts files.' })
      );
    }
    if (batch._count.imports >= batch.expectedFileCount) {
      throw new ServiceError(
        badRequestError({ message: 'This upload batch already has all of its files.' })
      );
    }

    return batch;
  }

  // Returns the imports to queue, in file name order: full sync parts sort before
  // incremental packs, and incremental packs sort by sequence.
  async completeBatch(d: { id: string }) {
    let batch = await this.getBatch(d);
    if (batch.status !== 'uploading') return { batch, imports: [] };

    if (!batch.imports.length) {
      throw new ServiceError(
        badRequestError({ message: 'Upload at least one slate pack before finishing.' })
      );
    }

    let claimed = await db.slatePackImportBatch.updateMany({
      where: { oid: batch.oid, status: 'uploading' },
      data: { status: 'processing' }
    });
    if (!claimed.count) return { batch: await this.getBatch(d), imports: [] };

    await this.refreshBatch({ batchOid: batch.oid });

    return {
      batch: await this.getBatch(d),
      imports: batch.imports.filter(packImport => packImport.status === 'pending')
    };
  }

  async refreshBatch(d: { batchOid: bigint }) {
    let open = await db.slatePackImport.count({
      where: { batchOid: d.batchOid, status: { in: ['pending', 'processing'] } }
    });
    if (open) return;

    await db.slatePackImportBatch.updateMany({
      where: { oid: d.batchOid, status: 'processing' },
      data: { status: 'completed', completedAt: new Date() }
    });
  }

  async afterImport(d: { packImportId: string }) {
    let packImport = await db.slatePackImport.findFirst({ where: { id: d.packImportId } });
    if (!packImport) return;

    if (packImport.channelUrl && packImport.channelSubRegistryId) {
      await this.advanceWatermark({
        channelUrl: packImport.channelUrl,
        subRegistryId: packImport.channelSubRegistryId
      });
    }

    if (packImport.batchOid) await this.refreshBatch({ batchOid: packImport.batchOid });
  }

  async advanceWatermark(channel: PackChannelKey) {
    let state = await db.mirrorPackChannel.upsert({
      where: {
        channelUrl_subRegistryId: {
          channelUrl: channel.channelUrl,
          subRegistryId: channel.subRegistryId
        }
      },
      create: {
        ...getId('mirrorPackChannel'),
        channelUrl: channel.channelUrl,
        subRegistryId: channel.subRegistryId
      },
      update: {}
    });

    let imports = await this.listTrackedImports(channel);
    let watermark = computeWatermark({
      watermark: state.watermark,
      incrementalSequences: imports.flatMap(packImport =>
        packImport.kind === 'incremental' && packImport.sequence ? [packImport.sequence] : []
      ),
      completeFullSyncs: getCompleteFullSyncs(imports)
    });

    if (watermark > state.watermark) {
      await db.mirrorPackChannel.updateMany({
        where: { oid: state.oid, watermark: { lt: watermark } },
        data: { watermark }
      });
    }

    return watermark;
  }

  async getPrimaryChannel(): Promise<PackChannelKey | null> {
    let upstreams = await db.mirrorUpstream.findMany({
      where: { status: 'active', subRegistryId: { not: null } },
      orderBy: { createdAt: 'asc' }
    });

    let upstream =
      upstreams.find(upstream => upstream.identifier === LICENSE_UPSTREAM_IDENTIFIER) ??
      upstreams.find(upstream => upstream.source === 'static') ??
      upstreams[0];
    let channelUrl = upstream ? normalizePackChannelUrl(upstream.url) : null;
    if (upstream && channelUrl) return { channelUrl, subRegistryId: upstream.subRegistryId! };

    let latest = await db.mirrorPackChannel.findFirst({ orderBy: { updatedAt: 'desc' } });
    return latest
      ? { channelUrl: latest.channelUrl, subRegistryId: latest.subRegistryId }
      : null;
  }

  async getPackSyncStatus() {
    let channel = await this.getPrimaryChannel();
    if (!channel) {
      return { channel: null, watermark: 0, highestSequence: 0, missingSequences: [] };
    }

    let state = await db.mirrorPackChannel.findUnique({
      where: {
        channelUrl_subRegistryId: {
          channelUrl: channel.channelUrl,
          subRegistryId: channel.subRegistryId
        }
      }
    });
    let watermark = state?.watermark ?? 0;
    let sequences = await this.listImportedSequences(channel);

    return {
      channel: { url: channel.channelUrl, subRegistryId: channel.subRegistryId },
      watermark,
      highestSequence: Math.max(watermark, ...sequences),
      missingSequences: findMissingSequences({
        watermark,
        incrementalSequences: sequences,
        limit: maxMissingSequences
      })
    };
  }

  async getBatchIssues(d: {
    batch: SlatePackBatchWithImports;
  }): Promise<SlatePackBatchIssue[]> {
    let issues: Omit<SlatePackBatchIssue, 'severity'>[] = [];
    let withSeverity = () =>
      issues.map(issue => ({ ...issue, severity: issueSeverity[issue.type] }));

    let primary = await this.getPrimaryChannel();

    for (let packImport of d.batch.imports) {
      let issue = (type: SlatePackBatchIssueType, message: string) =>
        issues.push({ type, message, packImportId: packImport.id });

      if (packImport.status === 'failed') {
        issue('failed', `${packImport.fileName} could not be imported: ${packImport.error}`);
        continue;
      }
      if (packImport.status !== 'completed') continue;

      if (!packImport.kind) {
        issue(
          'untracked',
          `${packImport.fileName} is not part of a pack channel, so it does not count towards the last imported pack.`
        );
        continue;
      }

      let channel = {
        channelUrl: packImport.channelUrl!,
        subRegistryId: packImport.channelSubRegistryId!
      };

      if (!packImport.manifestVerified) {
        issue(
          'unverified',
          `The manifest of ${describeImport(packImport)} has no valid signature from a trusted key. Its versions were checked one by one, but it does not count towards the last imported pack.`
        );
      }
      if (primary && !isSameChannel(primary, channel)) {
        issue(
          'foreign_channel',
          `${describeImport(packImport)} is from ${channel.subRegistryId}, but this installation syncs from ${primary.subRegistryId}.`
        );
      }
      if (packImport.rejectedCount) {
        issue(
          'rejected_versions',
          `${packImport.rejectedCount} versions in ${describeImport(packImport)} were rejected. Upload it again once the cause is fixed.`
        );
      }
    }

    if (d.batch.status !== 'completed') return withSeverity();

    let fullSyncIds = [
      ...new Set(d.batch.imports.flatMap(packImport => packImport.fullSyncId ?? []))
    ];
    for (let fullSyncId of fullSyncIds) {
      let parts = await db.slatePackImport.findMany({
        where: { fullSyncId, kind: 'full', status: 'completed' },
        select: { part: true, partCount: true }
      });
      let partCount = parts[0]?.partCount ?? 0;
      let present = new Set(parts.map(part => part.part));
      let missing = Array.from({ length: partCount }, (_, index) => index + 1).filter(
        part => !present.has(part)
      );

      if (missing.length) {
        issues.push({
          type: 'incomplete_full_sync',
          message: `Full sync ${fullSyncId} is missing parts ${missing.join(', ')} of ${partCount}. Upload them to finish the full sync.`,
          packImportId: null
        });
      }
    }

    if (primary) {
      let status = await this.getPackSyncStatus();
      if (status.missingSequences.length) {
        issues.push({
          type: 'missing_sequences',
          message: `Packs ${formatSequences(status.missingSequences)} have not been imported. The last imported pack stays at #${status.watermark} until they are uploaded.`,
          packImportId: null
        });
      }
    }

    return withSeverity();
  }

  async cleanupAbandonedBatches() {
    let batches = await db.slatePackImportBatch.findMany({
      where: {
        status: 'uploading',
        createdAt: { lt: new Date(Date.now() - abandonedBatchMs) }
      },
      include: { imports: true },
      take: 100
    });

    for (let batch of batches) {
      for (let packImport of batch.imports) {
        await storage.deleteObject(packImport.bucket, packImport.storageKey).catch(() => {});
        await db.slatePackImport.update({
          where: { oid: packImport.oid },
          data: {
            status: 'failed',
            error: 'The upload was never finished.',
            completedAt: new Date()
          }
        });
      }

      await db.slatePackImportBatch.update({
        where: { oid: batch.oid },
        data: { status: 'completed', completedAt: new Date() }
      });
    }

    return { cleaned: batches.length };
  }

  private async listTrackedImports(channel: PackChannelKey) {
    return db.slatePackImport.findMany({
      where: watermarkEligibleWhere(channel),
      select: {
        kind: true,
        sequence: true,
        fullSyncId: true,
        part: true,
        partCount: true,
        coversSequence: true
      }
    });
  }

  private async listImportedSequences(channel: PackChannelKey) {
    let imports = await db.slatePackImport.findMany({
      where: { ...watermarkEligibleWhere(channel), kind: 'incremental' },
      select: { sequence: true },
      distinct: ['sequence']
    });

    return imports.flatMap(packImport => (packImport.sequence ? [packImport.sequence] : []));
  }
}

export let slatePackBatchService = Service.create(
  'slatePackBatchService',
  () => new slatePackBatchServiceImpl()
).build();
