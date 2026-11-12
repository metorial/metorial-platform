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
import { contentChecksumAlgorithm } from '../lib/signature';
import {
  getSlatePackEntryPath,
  parseSlatePackManifest,
  SLATE_PACK_FORMAT,
  SLATE_PACK_FORMAT_VERSION,
  SLATE_PACK_MANIFEST_PATH,
  SLATE_PACK_MAX_ENTRIES,
  type SlatePackManifest
} from '../lib/slatePack/format';
import { getEffectiveCurrentSlateVersion } from '../lib/slateVersion/current';
import { buildSlateFilterClause, type SubRegistryWithFilters } from '../lib/subRegistryFilter';
import { storage } from '../storage';
import { mirrorImportService } from './mirrorImport';

let GB = 1024 * 1024 * 1024;

let defaultMaxPackBytes = 8 * GB;

let maxManifestBytes = 64 * 1024 * 1024;

let maxEntryBytes = 256 * 1024 * 1024;

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

let sanitizeFileName = (fileName: string) =>
  fileName.replace(/[^\w.\- ]+/g, '_').slice(0, maxFileNameLength) || 'upload.slatepack';

class slatePackServiceImpl {
  async createImport(d: { fileName: string; body: ReadableStream<Uint8Array> }) {
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
        storageKey
      }
    });
  }

  async listImports() {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => await db.slatePackImport.findMany({ ...opts }))
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

      let manifest = parseSlatePackManifest(
        (await readBounded(manifestFile, maxManifestBytes)).toString('utf-8')
      );

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

    let selected = slates.flatMap(slate => {
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

    if (selected.length > SLATE_PACK_MAX_ENTRIES) {
      throw new ServiceError(
        badRequestError({
          message: `The export would contain more than ${SLATE_PACK_MAX_ENTRIES} versions.`,
          hint: 'Select specific slates or export only current versions.'
        })
      );
    }

    let manifest: SlatePackManifest = {
      format: SLATE_PACK_FORMAT,
      formatVersion: SLATE_PACK_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      source: {
        url: env.url.SERVICE_PUBLIC_URL,
        subRegistryId: d.subRegistry?.identifier ?? null
      },
      entries: selected.map(({ slate, version }) => ({
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

    return {
      entryCount: manifest.entries.length,
      checksumAlgorithm: contentChecksumAlgorithm,
      stream: this.streamPack({
        manifest,
        bundles: selected.map(({ version }, index) => ({
          path: manifest.entries[index]!.path,
          bucket: version.bundleArtifact.bucket,
          storageKey: version.bundleArtifact.storageKey
        }))
      })
    };
  }

  private streamPack(d: {
    manifest: SlatePackManifest;
    bundles: { path: string; bucket: string; storageKey: string }[];
  }) {
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
            let manifestFile = new ZipPassThrough(SLATE_PACK_MANIFEST_PATH);
            zip.add(manifestFile);
            manifestFile.push(
              new TextEncoder().encode(JSON.stringify(d.manifest, null, 2)),
              true
            );

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
