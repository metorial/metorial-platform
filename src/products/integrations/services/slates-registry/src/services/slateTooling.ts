import {
  badRequestError,
  conflictError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { SlateToolingArtifactOrigin, Tenant, User } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import {
  findValidSlateToolingSignature,
  type SlateVersionSignatureInput
} from '../lib/signature';
import {
  isKnownToolingKind,
  knownToolingKinds,
  parseSlateToolingArchive,
  selectToolingVersion
} from '../lib/slateTooling';
import { isRootMode, isSignatureVerificationRequired } from '../mode';
import { storage } from '../storage';
import { mirrorService } from './mirror';
import type { MirrorImportSource } from './mirrorImport';
import { signingKeyService } from './signingKey';

let maxMessageLength = 1000;

let defaultPublisherTenants = ['metorial'];

let signaturePattern = /^[A-Za-z0-9_-]{43,128}$/;

let kidPattern = /^[A-Za-z0-9_-]{43}$/;

let include = { artifact: true, signatures: { orderBy: { createdAt: 'asc' as const } } };

type ImportOutcome = {
  status: 'imported' | 'skipped' | 'conflict' | 'rejected' | 'omitted';
  message?: string;
};

let errorMessage = (error: unknown) => {
  if (error instanceof ServiceError) return error.data.message;
  if (error instanceof Error) return error.message;

  return String(error);
};

let unknownKindError = (kind: string) =>
  new ServiceError(badRequestError({ message: `Unknown tooling kind ${kind}.` }));

let getPublisherTenants = () => {
  let configured = env.tooling.SLATES_TOOLING_PUBLISHER_TENANTS?.split(',')
    .map(tenant => tenant.trim())
    .filter(Boolean);

  return configured?.length ? configured : defaultPublisherTenants;
};

class slateToolingServiceImpl {
  async authorizePublisher(d: { user: User; tenant: Tenant }) {
    if (!isRootMode()) {
      throw new ServiceError(
        forbiddenError({ message: 'Tooling can only be published to a root registry.' })
      );
    }

    if (
      d.user.access !== 'read_write' ||
      !getPublisherTenants().includes(d.tenant.identifier)
    ) {
      throw new ServiceError(
        forbiddenError({ message: 'This user is not allowed to publish tooling.' })
      );
    }
  }

  async publish(d: { kind: string; version: string; buffer: Buffer }) {
    if (!isKnownToolingKind(d.kind)) throw unknownKindError(d.kind);

    let parsed = await parseSlateToolingArchive(d);

    let existing = await this.findExisting(d);
    if (existing) {
      if (existing.checksum === parsed.contentChecksum) return existing;

      throw new ServiceError(
        conflictError({
          message: `Tooling ${d.kind}@${d.version} already exists with different contents.`
        })
      );
    }

    let tooling = await this.store({ parsed, buffer: d.buffer, origin: 'upload' });

    try {
      await signingKeyService.signToolingArtifacts({ artifacts: [tooling] });
    } catch (error) {
      // The signing cron backfills anything missed here.
      console.error('[Registry]: Failed to sign tooling on publish', error);
    }

    return this.get(d);
  }

  async importVerified(d: {
    source: MirrorImportSource;
    kind: string;
    version: string;
    bundle: Buffer;
    signatures: SlateVersionSignatureInput[];
  }) {
    let outcome = await this.importInner(d).catch((error): ImportOutcome => ({
      status: 'rejected',
      message: errorMessage(error)
    }));

    await this.recordResult({ ...d, outcome });

    return outcome;
  }

  async recordResult(d: {
    source: MirrorImportSource;
    kind: string;
    version: string;
    outcome: ImportOutcome;
  }) {
    if (d.outcome.status === 'omitted') return;

    await db.mirrorResult.create({
      data: {
        ...getId('mirrorResult'),
        status: d.outcome.status,
        slateIdentifier: `tooling:${d.kind}`,
        version: d.version,
        message: d.outcome.message?.slice(0, maxMessageLength),
        upstreamOid: d.source.type === 'upstream' ? d.source.upstream.oid : undefined,
        packImportOid: d.source.type === 'pack' ? d.source.packImport.oid : undefined
      }
    });
  }

  async list(d: { kind?: string } = {}) {
    let artifacts = await db.slateToolingArtifact.findMany({
      where: { kind: d.kind },
      include,
      orderBy: { createdAt: 'desc' }
    });

    return artifacts;
  }

  async get(d: { kind: string; version: string }) {
    let tooling = await db.slateToolingArtifact.findUnique({
      where: { kind_version: { kind: d.kind, version: d.version } },
      include
    });
    if (!tooling) {
      throw new ServiceError(
        notFoundError({ entity: 'slate.tooling', id: `${d.kind}@${d.version}` })
      );
    }

    return tooling;
  }

  async resolve(d: { kind: string; protocols: string[]; version?: string | null }) {
    let artifacts = await db.slateToolingArtifact.findMany({
      where: { kind: d.kind, protocol: { in: d.protocols } },
      include
    });

    let tooling = selectToolingVersion({
      artifacts,
      protocols: d.protocols,
      version: d.version
    });
    if (!tooling) {
      throw new ServiceError(
        notFoundError({
          entity: 'slate.tooling',
          id: d.version ? `${d.kind}@${d.version}` : d.kind
        })
      );
    }

    return tooling;
  }

  async listNewestPerKnownKind() {
    let result = [];

    for (let kind of Object.keys(knownToolingKinds)) {
      let artifacts = await db.slateToolingArtifact.findMany({ where: { kind }, include });
      let protocols = [...new Set(artifacts.map(artifact => artifact.protocol))];

      for (let protocol of protocols) {
        let newest = selectToolingVersion({ artifacts, protocols: [protocol] });
        if (newest) result.push(newest);
      }
    }

    return result;
  }

  async getBundle(d: { tooling: { artifact: { bucket: string; storageKey: string } } }) {
    let object = await storage.getObjectStream(
      d.tooling.artifact.bucket,
      d.tooling.artifact.storageKey
    );

    return Buffer.from(await new Response(object.stream).arrayBuffer());
  }

  private async importInner(d: {
    source: MirrorImportSource;
    kind: string;
    version: string;
    bundle: Buffer;
    signatures: SlateVersionSignatureInput[];
  }): Promise<ImportOutcome> {
    if (!isKnownToolingKind(d.kind)) {
      return { status: 'skipped', message: `Unknown tooling kind ${d.kind}.` };
    }

    let parsed = await parseSlateToolingArchive({
      buffer: d.bundle,
      kind: d.kind,
      version: d.version
    });

    let signatures = d.signatures.filter(
      signature => kidPattern.test(signature.kid) && signaturePattern.test(signature.signature)
    );

    let existing = await this.findExisting(d);
    if (existing) {
      if (existing.checksum !== parsed.contentChecksum) {
        return {
          status: 'conflict',
          message: 'This tooling version already exists with different contents.'
        };
      }

      await this.storeSignatures({ toolingArtifactOid: existing.oid, signatures });
      return { status: 'skipped', message: 'This tooling version was already imported.' };
    }

    // The checksum is recomputed from the archive, so a signature only verifies if the
    // bytes are exactly what the root registry signed.
    if (isSignatureVerificationRequired()) {
      let kid = await findValidSlateToolingSignature({
        statement: {
          kind: d.kind,
          version: d.version,
          contentChecksum: parsed.contentChecksum
        },
        signatures,
        trustedKeys: await mirrorService.getTrustedKeys()
      });
      if (!kid)
        return { status: 'rejected', message: 'No valid signature from a trusted key.' };
    }

    let tooling = await this.store({
      parsed,
      buffer: d.bundle,
      origin: d.source.type === 'upstream' ? 'upstream' : 'pack'
    }).catch(error => {
      if (error instanceof ServiceError && error.data.status === 409) return null;
      throw error;
    });
    if (!tooling) {
      return {
        status: 'conflict',
        message: 'This tooling version was imported concurrently.'
      };
    }

    await this.storeSignatures({ toolingArtifactOid: tooling.oid, signatures });

    return { status: 'imported' };
  }

  private async findExisting(d: { kind: string; version: string }) {
    return db.slateToolingArtifact.findUnique({
      where: { kind_version: { kind: d.kind, version: d.version } },
      include
    });
  }

  private async store(d: {
    parsed: Awaited<ReturnType<typeof parseSlateToolingArchive>>;
    buffer: Buffer;
    origin: SlateToolingArtifactOrigin;
  }) {
    let { manifest, contentChecksum } = d.parsed;

    let artifactIds = getId('artifact');
    let bucket = env.storage.PACKAGE_BUCKET_NAME;
    let storageKey = `tooling/${manifest.kind}/${manifest.version}/${artifactIds.id}.zip`;

    await storage.putObject(bucket, storageKey, d.buffer, 'application/zip');

    try {
      return await db.$transaction(async db => {
        let artifact = await db.artifact.create({
          data: {
            ...artifactIds,
            bucket,
            storageKey,
            size: BigInt(d.buffer.length),
            mimeType: 'application/zip',
            checksum: contentChecksum
          }
        });

        return db.slateToolingArtifact.create({
          data: {
            ...getId('slateToolingArtifact'),
            kind: manifest.kind,
            version: manifest.version,
            protocol: manifest.protocol,
            checksum: contentChecksum,
            origin: d.origin,
            metadata: { main: manifest.main, exports: manifest.exports },
            artifactOid: artifact.oid
          }
        });
      });
    } catch (error) {
      await storage.deleteObject(bucket, storageKey).catch(() => {});

      if ((error as { code?: string })?.code === 'P2002') {
        throw new ServiceError(
          conflictError({
            message: `Tooling ${manifest.kind}@${manifest.version} already exists.`
          })
        );
      }

      throw error;
    }
  }

  private async storeSignatures(d: {
    toolingArtifactOid: bigint;
    signatures: SlateVersionSignatureInput[];
  }) {
    if (!d.signatures.length) return;

    await db.slateToolingArtifactSignature.createMany({
      skipDuplicates: true,
      data: d.signatures.map(signature => ({
        ...getId('slateToolingArtifactSignature'),
        kid: signature.kid,
        signature: signature.signature,
        toolingArtifactOid: d.toolingArtifactOid
      }))
    });
  }
}

export let slateToolingService = Service.create(
  'slateToolingService',
  () => new slateToolingServiceImpl()
).build();
