import { badRequestError, createError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Zip, ZipPassThrough } from 'fflate';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import unzipper from 'unzipper';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import {
  contentChecksumAlgorithm,
  findValidSlatePackManifestSignature
} from '../lib/signature';
import {
  getSlatePackEntryPath,
  parseSlatePackManifest,
  parseSlatePackSignatures,
  serializeSlatePackSignatures,
  SLATE_PACK_FORMAT,
  SLATE_PACK_FORMAT_VERSION,
  SLATE_PACK_MANIFEST_PATH,
  SLATE_PACK_MAX_ENTRIES,
  SLATE_PACK_SIGNATURE_PATH,
  type SlatePackDelivery,
  type SlatePackManifest
} from '../lib/slatePack/format';
import { getEffectiveCurrentSlateVersion } from '../lib/slateVersion/current';
import { buildSlateFilterClause, type SubRegistryWithFilters } from '../lib/subRegistryFilter';
import { storage } from '../storage';
import { isSignatureVerificationRequired } from '../mode';
import { mirrorService } from './mirror';
import { mirrorImportService } from './mirrorImport';
import { normalizePackChannelUrl, slatePackBatchService } from './slatePackBatch';
import { signingKeyService } from './signingKey';

let GB = 1024 * 1024 * 1024;

let defaultMaxPackBytes = 8 * GB;

let maxManifestBytes = 64 * 1024 * 1024;

let maxEntryBytes = 256 * 1024 * 1024;

let maxSignatureBytes = 1024 * 1024;

let maxFileNameLength = 255;

let progressEvery = 25;

let payloadTooLargeError = createError({
  status: 413,
  code: 'payload_too_large',
  message: 'The slate pack is too large.'
});

let getMaxPackBytes = () => env.mirror.SLATES_PACK_MAX_BYTES ?? defaultMaxPackBytes;

let limitStream = (stream: ReadableStream<Uint8Array>, maxBytes: number) => {
  let size = 0;

  return {
    getSize: () => size,
    stream: stream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          size += chunk.byteLength;
          if (size > maxBytes) {
            controller.error(new ServiceError(payloadTooLargeError()));
            return;
          }
          controller.enqueue(chunk);
        }
      })
    )
  };
};

let readBounded = async (file: unzipper.File, maxBytes: number) => {
  let chunks: Buffer[] = [];
  let size = 0;

  for await (let chunk of file.stream()) {
    size += chunk.length;
    if (size > maxBytes) throw new Error(`${file.path} is too large.`);
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

export type PackSelection = {
  slate: {
    fullIdentifier: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
  };
  version: {
    version: string;
    bundleArtifact: { checksum: string; bucket: string; storageKey: string };
    signatures: { kid: string; signature: string }[];
  };
};

type PackBundle = { path: string; bucket: string; storageKey: string };

let encoder = new TextEncoder();

let sanitizeFileName = (fileName: string) =>
  fileName.replace(/[^\w.\- ]+/g, '_').slice(0, maxFileNameLength) || 'upload.slatepack';

class slatePackServiceImpl {
  async createImport(d: {
    fileName: string;
    body: ReadableStream<Uint8Array>;
    batch?: { oid: bigint };
  }) {
    let ids = getId('slatePackImport');
    let bucket = env.storage.PACKAGE_BUCKET_NAME;
    let storageKey = `slate-packs/${ids.id}.slatepack`;

    let limited = limitStream(d.body, getMaxPackBytes());
    await storage.putObject(bucket, storageKey, limited.stream, 'application/zip');

    if (limited.getSize() === 0) {
      await storage.deleteObject(bucket, storageKey).catch(() => {});
      throw new ServiceError(
        badRequestError({ message: 'The uploaded slate pack is empty.' })
      );
    }

    return db.slatePackImport.create({
      data: {
        ...ids,
        status: 'pending',
        fileName: sanitizeFileName(d.fileName),
        size: BigInt(limited.getSize()),
        bucket,
        storageKey,
        batchOid: d.batch?.oid
      }
    });
  }

  async listImports(d: { batchId?: string } = {}) {
    let batch = d.batchId ? await slatePackBatchService.getBatch({ id: d.batchId }) : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slatePackImport.findMany({
            ...opts,
            where: batch ? { batchOid: batch.oid } : {}
          })
      )
    );
  }

  async getImport(d: { id: string }) {
    let packImport = await db.slatePackImport.findFirst({ where: { id: d.id } });
    if (!packImport) throw new ServiceError(notFoundError('mirror.pack_import'));

    return packImport;
  }

  async processImport(d: { id: string }) {
    let claimed = await db.slatePackImport.updateMany({
      where: { id: d.id, status: 'pending' },
      data: { status: 'processing' }
    });
    if (!claimed.count) return;

    let packImport = await this.getImport(d);
    let directory = await mkdtemp(join(tmpdir(), 'slatepack-'));
    let counts = { imported: 0, skipped: 0, conflict: 0, rejected: 0 };

    let saveCounts = (data: Record<string, unknown> = {}) =>
      db.slatePackImport.update({
        where: { oid: packImport.oid },
        data: {
          importedCount: counts.imported,
          skippedCount: counts.skipped,
          conflictCount: counts.conflict,
          rejectedCount: counts.rejected,
          ...data
        }
      });

    try {
      let path = join(directory, 'pack.slatepack');
      let object = await storage.getObjectStream(packImport.bucket, packImport.storageKey);
      await Bun.write(path, new Response(object.stream));

      let archive = await unzipper.Open.file(path).catch(() => {
        throw new Error('The slate pack is not a valid zip archive.');
      });
      let files = new Map(
        archive.files.filter(file => file.type === 'File').map(file => [file.path, file])
      );

      let manifestFile = files.get(SLATE_PACK_MANIFEST_PATH);
      if (!manifestFile) throw new Error(`The slate pack has no ${SLATE_PACK_MANIFEST_PATH}.`);

      let manifestBytes = await readBounded(manifestFile, maxManifestBytes);
      let manifest = parseSlatePackManifest(manifestBytes.toString('utf-8'));

      if (manifest.delivery) {
        await this.recordDelivery({
          packImport,
          delivery: manifest.delivery,
          manifestBytes,
          signatureFile: files.get(SLATE_PACK_SIGNATURE_PATH)
        });
      }

      for (let [index, entry] of manifest.entries.entries()) {
        let file = files.get(entry.path);
        let bundle = file ? await readBounded(file, maxEntryBytes).catch(() => null) : null;

        let outcome = bundle
          ? await mirrorImportService.importVerifiedSlateVersion({
              source: { type: 'pack', packImport },
              identifier: entry.identifier,
              version: entry.version,
              bundle,
              signatures: entry.signatures,
              catalog: entry.catalog
            })
          : await this.recordMissingEntry({ packImportOid: packImport.oid, entry });

        if (outcome.status !== 'omitted') counts[outcome.status]++;
        if ((index + 1) % progressEvery === 0) await saveCounts();
      }

      await saveCounts({ status: 'completed', completedAt: new Date() });
    } catch (error) {
      await saveCounts({
        status: 'failed',
        error: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
        completedAt: new Date()
      });
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => {});
      await storage.deleteObject(packImport.bucket, packImport.storageKey).catch(() => {});
    }

    await slatePackBatchService.afterImport({ packImportId: packImport.id });
  }

  // A pack only counts towards the channel watermark if its manifest, and with it the
  // sequence number, carries a signature from a trusted key.
  private async recordDelivery(d: {
    packImport: { oid: bigint };
    delivery: SlatePackDelivery;
    manifestBytes: Buffer;
    signatureFile: unzipper.File | undefined;
  }) {
    let channelUrl = normalizePackChannelUrl(d.delivery.channel.url);
    if (!channelUrl) return;

    let signatures = d.signatureFile
      ? await readBounded(d.signatureFile, maxSignatureBytes)
          .then(content => parseSlatePackSignatures(content.toString('utf-8')))
          .catch(() => [])
      : [];

    let manifestVerified = isSignatureVerificationRequired()
      ? !!(await findValidSlatePackManifestSignature({
          manifest: d.manifestBytes,
          signatures,
          trustedKeys: await mirrorService.getTrustedKeys()
        }))
      : true;

    await db.slatePackImport.update({
      where: { oid: d.packImport.oid },
      data: {
        kind: d.delivery.kind,
        channelUrl,
        channelSubRegistryId: d.delivery.channel.subRegistryId,
        sequence: d.delivery.kind === 'incremental' ? d.delivery.sequence : null,
        fullSyncId: d.delivery.kind === 'full' ? d.delivery.fullSyncId : null,
        part: d.delivery.kind === 'full' ? d.delivery.part : null,
        partCount: d.delivery.kind === 'full' ? d.delivery.partCount : null,
        coversSequence: d.delivery.kind === 'full' ? d.delivery.coversSequence : null,
        manifestVerified
      }
    });
  }

  private async recordMissingEntry(d: {
    packImportOid: bigint;
    entry: { identifier: string; version: string; path: string };
  }) {
    await db.mirrorResult.create({
      data: {
        ...getId('mirrorResult'),
        status: 'rejected',
        slateIdentifier: d.entry.identifier,
        version: d.entry.version,
        message: `The slate pack is missing ${d.entry.path} or it could not be read.`,
        packImportOid: d.packImportOid
      }
    });

    return { status: 'rejected' as const };
  }

  async exportPack(d: {
    tenant?: Tenant;
    subRegistry?: SubRegistryWithFilters | null;
    versions: 'current' | 'all';
    slateIds?: string[];
  }) {
    let selected = await this.selectVersions(d);

    if (selected.length > SLATE_PACK_MAX_ENTRIES) {
      throw new ServiceError(
        badRequestError({
          message: `The export would contain more than ${SLATE_PACK_MAX_ENTRIES} versions.`,
          hint: 'Select specific slates or export only current versions.'
        })
      );
    }

    let contents = this.buildPackContents({
      selected,
      source: {
        url: env.url.SERVICE_PUBLIC_URL,
        subRegistryId: d.subRegistry?.identifier ?? null
      },
      delivery: null
    });

    return {
      entryCount: contents.manifest.entries.length,
      checksumAlgorithm: contentChecksumAlgorithm,
      stream: await this.streamSignedPack(contents)
    };
  }

  async selectVersions(d: {
    tenant?: Pick<Tenant, 'oid'>;
    subRegistry?: SubRegistryWithFilters | null;
    versions: 'current' | 'all';
    slateIds?: string[];
  }) {
    let slateIds = d.slateIds?.map(id => id.replace(/^@/, ''));

    let slates = await db.slate.findMany({
      where: {
        status: 'active',
        AND: [
          buildSlateFilterClause(d.subRegistry, d.tenant?.oid),
          slateIds?.length
            ? { OR: [{ id: { in: slateIds } }, { fullIdentifier: { in: slateIds } }] }
            : {}
        ]
      },
      include: {
        unbuiltCurrentVersion: true,
        builtOrUnbuiltCurrentVersion: true,
        activation: { include: { pinnedVersion: true } },
        slateVersions: {
          where: { bundleArtifact: { checksum: { not: '' } } },
          include: { bundleArtifact: true, signatures: true },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { fullIdentifier: 'asc' }
    });

    return slates.flatMap(slate => {
      if (d.versions === 'all')
        return slate.slateVersions.map(version => ({ slate, version }));

      let current = getEffectiveCurrentSlateVersion({
        supportsBuilt: true,
        unbuiltCurrentVersion: slate.unbuiltCurrentVersion,
        builtOrUnbuiltCurrentVersion: slate.builtOrUnbuiltCurrentVersion,
        activation: slate.activation
      });
      let version = slate.slateVersions.find(version => version.oid === current?.oid);

      return version ? [{ slate, version }] : [];
    });
  }

  buildPackContents(d: {
    selected: PackSelection[];
    source: SlatePackManifest['source'];
    delivery: SlatePackDelivery | null;
  }) {
    let manifest: SlatePackManifest = {
      format: SLATE_PACK_FORMAT,
      formatVersion: SLATE_PACK_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      source: d.source,
      delivery: d.delivery,
      entries: d.selected.map(({ slate, version }) => ({
        identifier: slate.fullIdentifier,
        version: version.version,
        path: getSlatePackEntryPath({
          identifier: slate.fullIdentifier,
          version: version.version
        }),
        contentChecksum: version.bundleArtifact.checksum,
        signatures: version.signatures.map(signature => ({
          kid: signature.kid,
          signature: signature.signature
        })),
        catalog: { name: slate.name, description: slate.description, logoUrl: slate.logoUrl }
      }))
    };

    let bundles: PackBundle[] = d.selected.map(({ version }, index) => ({
      path: manifest.entries[index]!.path,
      bucket: version.bundleArtifact.bucket,
      storageKey: version.bundleArtifact.storageKey
    }));

    return { manifest, bundles };
  }

  async streamSignedPack(d: { manifest: SlatePackManifest; bundles: PackBundle[] }) {
    let manifestBytes = encoder.encode(JSON.stringify(d.manifest, null, 2));
    let signatures = await signingKeyService.signSlatePackManifest({ manifest: manifestBytes });

    return this.streamPack({
      files: [
        { path: SLATE_PACK_MANIFEST_PATH, content: manifestBytes },
        ...(signatures.length
          ? [
              {
                path: SLATE_PACK_SIGNATURE_PATH,
                content: encoder.encode(serializeSlatePackSignatures(signatures))
              }
            ]
          : [])
      ],
      bundles: d.bundles
    });
  }

  private streamPack(d: { files: { path: string; content: Uint8Array }[]; bundles: PackBundle[] }) {
    let resumePull: (() => void) | null = null;

    return new ReadableStream<Uint8Array>(
      {
        start: controller => {
          let zip = new Zip((error, chunk, final) => {
            if (error) return controller.error(error);

            controller.enqueue(chunk);
            if (final) controller.close();
          });

          let waitForDemand = async () => {
            while ((controller.desiredSize ?? 1) <= 0) {
              await new Promise<void>(resolve => (resumePull = resolve));
            }
          };

          (async () => {
            for (let file of d.files) {
              let entry = new ZipPassThrough(file.path);
              zip.add(entry);
              entry.push(file.content, true);
            }

            for (let bundle of d.bundles) {
              let file = new ZipPassThrough(bundle.path);
              zip.add(file);

              let object = await storage.getObjectStream(bundle.bucket, bundle.storageKey);
              let reader = object.stream.getReader();

              while (true) {
                let { done, value } = await reader.read();
                if (done || !value) break;

                file.push(value);
                await waitForDemand();
              }

              file.push(new Uint8Array(0), true);
            }

            zip.end();
          })().catch(error => controller.error(error));
        },

        pull: () => {
          resumePull?.();
          resumePull = null;
        }
      },
      { highWaterMark: 16 }
    );
  }
}

export let slatePackService = Service.create(
  'slatePackService',
  () => new slatePackServiceImpl()
).build();
