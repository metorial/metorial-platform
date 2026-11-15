import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { SlatePackChannel, SlatePackRelease } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import {
  getFullSyncId,
  getSlatePackReleaseFileName,
  planPackDownload,
  selectIncrementalItems,
  splitIntoParts
} from '../lib/slatePack/delivery';
import { SLATE_PACK_MAX_ENTRIES, type SlatePackDelivery } from '../lib/slatePack/format';
import { buildChangeNotificationFilterClause } from '../lib/subRegistryFilter';
import { buildChangeNotificationSupportsPrebuiltWhere } from '../lib/slateVersion/visibility';
import { isRootMode, isSigningEnabled } from '../mode';
import { storage } from '../storage';
import { signingKeyService } from './signingKey';
import { slatePackService, type PackSelection } from './slatePack';

let GB = 1024 * 1024 * 1024;

let hourMs = 60 * 60 * 1000;

let dayMs = 24 * hourMs;

let defaultTargetBytes = 1 * GB;

let defaultIncrementalRetentionDays = 180;

let maxPendingAgeMs = dayMs;

// Change notifications are committed in separate transactions, so very recent oids may
// still be joined by a lower oid. Waiting a few minutes keeps the cursor from skipping one.
let feedSettleMs = 5 * 60 * 1000;

let feedScanLimit = 5000;

let fullSyncIntervalMs = 7 * dayMs;

let keptFullSyncCount = 2;

let maxPlanReleases = 1000;

let maxErrorLength = 1000;

type SelectedVersion = PackSelection & {
  version: PackSelection['version'] & {
    oid: bigint;
    bundleArtifact: PackSelection['version']['bundleArtifact'] & { size: bigint };
  };
};

let getTargetBytes = () => env.mirror.SLATES_PACK_TARGET_BYTES ?? defaultTargetBytes;

let getIncrementalRetentionMs = () =>
  (env.mirror.SLATES_PACK_INCREMENTAL_RETENTION_DAYS ?? defaultIncrementalRetentionDays) *
  dayMs;

let packsUnavailable = () =>
  new ServiceError(
    badRequestError({ message: 'This registry does not publish slate packs.' })
  );

export let getConfiguredPackChannelIds = () =>
  (env.mirror.SLATES_PACK_CHANNELS ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

export let canBuildPacks = () => isRootMode() && isSigningEnabled();

let findBuildChannel = async (d: { channelId: string }) => {
  let channel = await db.slatePackChannel.findUnique({
    where: { id: d.channelId },
    include: { subRegistry: { include: { filters: true, tenant: true } } }
  });
  if (!channel) throw new ServiceError(notFoundError('slate_pack_channel'));

  return channel;
};

type BuildChannel = Awaited<ReturnType<typeof findBuildChannel>>;

class slatePackChannelServiceImpl {
  async ensureChannels() {
    let channels: SlatePackChannel[] = [];

    for (let identifier of getConfiguredPackChannelIds()) {
      let subRegistry = await db.subRegistry.findUnique({ where: { identifier } });
      if (!subRegistry) {
        console.warn(`[Registry]: Slate pack channel ${identifier} has no sub-registry`);
        continue;
      }

      channels.push(
        await db.slatePackChannel.upsert({
          where: { subRegistryOid: subRegistry.oid },
          create: { ...getId('slatePackChannel'), subRegistryOid: subRegistry.oid },
          update: {}
        })
      );
    }

    return channels;
  }

  async getChannel(d: { subRegistryId: string }) {
    if (!isRootMode()) throw packsUnavailable();

    let channel = await db.slatePackChannel.findFirst({
      where: { subRegistry: { identifier: d.subRegistryId } },
      include: { subRegistry: true }
    });
    if (!channel) throw new ServiceError(notFoundError('slate_pack_channel'));

    return channel;
  }

  async getChannelInfo(d: { subRegistryId: string }) {
    let channel = await this.getChannel(d);
    let latestFullSync = await this.getLatestFullSync({ channelOid: channel.oid });
    let oldestIncremental = await db.slatePackRelease.findFirst({
      where: { channelOid: channel.oid, kind: 'incremental', status: 'ready' },
      orderBy: { sequence: 'asc' }
    });

    return {
      channel,
      latestSequence: channel.lastSequence,
      oldestSequence: oldestIncremental?.sequence ?? null,
      latestFullSync: latestFullSync.length
        ? {
            fullSyncId: latestFullSync[0]!.fullSyncId!,
            coversSequence: latestFullSync[0]!.coversSequence ?? 0,
            partCount: latestFullSync.length,
            createdAt: latestFullSync[0]!.createdAt
          }
        : null
    };
  }

  async planDownload(d: {
    subRegistryId: string;
    fromSequence: number | null;
    mode: 'auto' | 'full';
  }) {
    let channel = await this.getChannel(d);
    let incrementals = await db.slatePackRelease.findMany({
      where: {
        channelOid: channel.oid,
        kind: 'incremental',
        status: 'ready'
      },
      orderBy: { sequence: 'asc' }
    });
    let latestFullSync = await this.getLatestFullSync({ channelOid: channel.oid });

    let plan = planPackDownload({
      fromSequence: d.fromSequence,
      mode: d.mode,
      latestSequence: channel.lastSequence,
      incrementals,
      latestFullSync: latestFullSync.length ? latestFullSync : null,
      maxReleases: maxPlanReleases
    });

    return { channel, ...plan };
  }

  async getRelease(d: { subRegistryId: string; releaseId: string }) {
    let channel = await this.getChannel(d);
    let release = await db.slatePackRelease.findFirst({
      where: { id: d.releaseId, channelOid: channel.oid, status: 'ready' }
    });
    if (!release) throw new ServiceError(notFoundError('slate_pack_release'));

    return { channel, release };
  }

  async openReleaseStream(d: { subRegistryId: string; releaseId: string }) {
    let { release } = await this.getRelease(d);
    let object = await storage.getObjectStream(release.bucket, release.storageKey);

    return { release, stream: object.stream };
  }

  // Returns whether another pack may be due right away.
  async buildIncremental(d: { channelId: string }) {
    if (!canBuildPacks()) return false;

    let channel = await findBuildChannel(d);
    let now = new Date();

    let notifications = await db.changeNotification.findMany({
      where: {
        AND: [
          buildChangeNotificationFilterClause(channel.subRegistry, channel.subRegistry.tenantOid),
          buildChangeNotificationSupportsPrebuiltWhere(true),
          {
            type: 'slate_version_created',
            oid: channel.feedCursorOid ? { gt: channel.feedCursorOid } : undefined,
            createdAt: { lt: new Date(now.getTime() - feedSettleMs) }
          }
        ]
      },
      orderBy: { oid: 'asc' },
      take: feedScanLimit,
      select: {
        oid: true,
        createdAt: true,
        slateVersion: { select: { oid: true, bundleArtifact: true } }
      }
    });

    let selection = selectIncrementalItems({
      items: notifications.map(notification => ({
        oid: notification.oid,
        createdAt: notification.createdAt,
        version:
          notification.slateVersion && notification.slateVersion.bundleArtifact.checksum
            ? {
                oid: notification.slateVersion.oid,
                size: Number(notification.slateVersion.bundleArtifact.size)
              }
            : null
      })),
      targetBytes: getTargetBytes(),
      maxPendingAgeMs,
      now,
      isPageFull: notifications.length === feedScanLimit
    });

    if (selection.action === 'wait') return false;

    if (selection.action === 'advance') {
      await db.slatePackChannel.update({
        where: { oid: channel.oid },
        data: { feedCursorOid: selection.cursorOid }
      });
      return true;
    }

    let selected = await this.loadSelectedVersions({
      versionOids: selection.versionOids.slice(0, SLATE_PACK_MAX_ENTRIES)
    });
    let sequence = channel.lastSequence + 1;

    let release = await this.writeRelease({
      channel,
      selected,
      delivery: {
        kind: 'incremental',
        channel: { url: env.url.SERVICE_PUBLIC_URL, subRegistryId: channel.subRegistry.identifier },
        sequence
      },
      fileName: getSlatePackReleaseFileName({
        subRegistryId: channel.subRegistry.identifier,
        kind: 'incremental',
        sequence
      })
    });

    // The sequence only moves if no other build claimed it, so a failed or duplicate build
    // never leaves a gap.
    let claimed = await db.$transaction(async db => {
      let updated = await db.slatePackChannel.updateMany({
        where: { oid: channel.oid, lastSequence: channel.lastSequence },
        data: {
          lastSequence: sequence,
          feedCursorOid: selection.cursorOid,
          lastIncrementalAt: now,
          lastBuildError: null,
          lastBuildErrorAt: null
        }
      });
      if (!updated.count) return false;

      await db.slatePackRelease.create({
        data: { ...release, kind: 'incremental', channelOid: channel.oid, sequence }
      });
      return true;
    });

    if (!claimed) {
      await storage.deleteObject(release.bucket, release.storageKey).catch(() => {});
      return false;
    }

    return true;
  }

  async buildFullSyncIfDue(d: { channelId: string; force?: boolean }) {
    if (!canBuildPacks()) return false;

    let channel = await findBuildChannel(d);
    let now = new Date();

    let isDue =
      d.force ||
      !channel.lastFullSyncAt ||
      now.getTime() - channel.lastFullSyncAt.getTime() >= fullSyncIntervalMs;
    if (!isDue) return false;

    let selection = await slatePackService.selectVersions({
      tenant: { oid: channel.subRegistry.tenantOid },
      subRegistry: channel.subRegistry,
      versions: 'current'
    });
    let selected = await this.loadSelectedVersions({
      versionOids: selection.map(item => item.version.oid)
    });

    let fullSyncId = getFullSyncId(now);
    let coversSequence = channel.lastSequence;
    let parts = splitIntoParts(
      selected,
      item => Number(item.version.bundleArtifact.size),
      getTargetBytes()
    ).flatMap(part => splitIntoParts(part, () => 1, SLATE_PACK_MAX_ENTRIES));
    if (!parts.length) parts = [[]];

    let written: Awaited<ReturnType<typeof this.writeRelease>>[] = [];

    try {
      for (let [index, part] of parts.entries()) {
        let partNumber = index + 1;

        written.push(
          await this.writeRelease({
            channel,
            selected: part,
            delivery: {
              kind: 'full',
              channel: {
                url: env.url.SERVICE_PUBLIC_URL,
                subRegistryId: channel.subRegistry.identifier
              },
              fullSyncId,
              part: partNumber,
              partCount: parts.length,
              coversSequence
            },
            fileName: getSlatePackReleaseFileName({
              subRegistryId: channel.subRegistry.identifier,
              kind: 'full',
              fullSyncId,
              part: partNumber,
              partCount: parts.length
            })
          })
        );
      }

      await db.$transaction(async db => {
        await db.slatePackRelease.createMany({
          data: written.map((release, index) => ({
            ...release,
            kind: 'full' as const,
            channelOid: channel.oid,
            fullSyncId,
            part: index + 1,
            partCount: parts.length,
            coversSequence
          }))
        });

        await db.slatePackChannel.update({
          where: { oid: channel.oid },
          data: { lastFullSyncAt: now, lastBuildError: null, lastBuildErrorAt: null }
        });
      });
    } catch (error) {
      await Promise.all(
        written.map(release =>
          storage.deleteObject(release.bucket, release.storageKey).catch(() => {})
        )
      );
      throw error;
    }

    return true;
  }

  async prune(d: { channelId: string }) {
    let channel = await findBuildChannel(d);
    let now = new Date();

    let fullSyncs = await db.slatePackRelease.findMany({
      where: { channelOid: channel.oid, kind: 'full', status: 'ready' },
      distinct: ['fullSyncId'],
      orderBy: { fullSyncId: 'desc' },
      select: { fullSyncId: true, coversSequence: true }
    });

    let staleFullSyncIds = fullSyncs.slice(keptFullSyncCount).map(sync => sync.fullSyncId!);
    let newestCovers = fullSyncs[0]?.coversSequence ?? null;

    let stale = await db.slatePackRelease.findMany({
      where: {
        channelOid: channel.oid,
        status: 'ready',
        OR: [
          { kind: 'full', fullSyncId: { in: staleFullSyncIds } },
          ...(newestCovers !== null
            ? [
                {
                  kind: 'incremental' as const,
                  sequence: { lte: newestCovers },
                  createdAt: { lt: new Date(now.getTime() - getIncrementalRetentionMs()) }
                }
              ]
            : [])
        ]
      }
    });

    for (let release of stale) {
      await storage.deleteObject(release.bucket, release.storageKey).catch(() => {});
      await db.slatePackRelease.update({
        where: { oid: release.oid },
        data: { status: 'pruned', prunedAt: now }
      });
    }

    return { pruned: stale.length };
  }

  async recordBuildError(d: { channelId: string; error: unknown }) {
    let message = d.error instanceof Error ? d.error.message : String(d.error);

    await db.slatePackChannel.update({
      where: { id: d.channelId },
      data: { lastBuildError: message.slice(0, maxErrorLength), lastBuildErrorAt: new Date() }
    });
  }

  private async getLatestFullSync(d: { channelOid: bigint }) {
    let candidates = await db.slatePackRelease.findMany({
      where: { channelOid: d.channelOid, kind: 'full', status: 'ready' },
      orderBy: [{ fullSyncId: 'desc' }, { part: 'asc' }]
    });

    let groups = new Map<string, SlatePackRelease[]>();
    for (let release of candidates) {
      let group = groups.get(release.fullSyncId!) ?? [];
      group.push(release);
      groups.set(release.fullSyncId!, group);
    }

    for (let group of groups.values()) {
      if (group.length === group[0]!.partCount) return group;
    }

    return [];
  }

  // Signing normally happens on publish, with a cron backfilling anything missed. Packs
  // sign again here so a version is never shipped before every active key has signed it.
  private async loadSelectedVersions(d: { versionOids: bigint[] }) {
    let load = () =>
      db.slateVersion.findMany({
        where: { oid: { in: d.versionOids }, bundleArtifact: { checksum: { not: '' } } },
        include: { slate: true, bundleArtifact: true, signatures: true },
        orderBy: { oid: 'asc' }
      });

    await signingKeyService.signSlateVersions({ versions: await load() });

    let versions = await load();
    return versions.map(
      (version): SelectedVersion => ({
        slate: version.slate,
        version
      })
    );
  }

  private async writeRelease(d: {
    channel: BuildChannel;
    selected: SelectedVersion[];
    delivery: SlatePackDelivery;
    fileName: string;
  }) {
    let ids = getId('slatePackRelease');
    let bucket = env.storage.PACKAGE_BUCKET_NAME;
    let storageKey = `slate-pack-releases/${d.channel.id}/${ids.id}.slatepack`;

    let contents = slatePackService.buildPackContents({
      selected: d.selected,
      source: {
        url: env.url.SERVICE_PUBLIC_URL,
        subRegistryId: d.channel.subRegistry.identifier
      },
      delivery: d.delivery
    });

    let stored = await storage.putObject(
      bucket,
      storageKey,
      await slatePackService.streamSignedPack(contents),
      'application/zip'
    );

    return {
      ...ids,
      fileName: d.fileName,
      entryCount: contents.manifest.entries.length,
      size: BigInt(stored.digests.size),
      sha256: stored.digests.sha256,
      bucket,
      storageKey
    };
  }
}

export let slatePackChannelService = Service.create(
  'slatePackChannelService',
  () => new slatePackChannelServiceImpl()
).build();
