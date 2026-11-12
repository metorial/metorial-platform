import { ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  MirrorResultStatus,
  MirrorUpstream,
  SlatePackImport
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { readZipEntries } from '../lib/slatePackage/archive';
import { normalizeSlatePackage, parseSlateFullIdentifier } from '../lib/slatePackage/manifest';
import {
  findValidSlateVersionSignature,
  type SlateVersionSignatureInput
} from '../lib/signature';
import { isSignatureVerificationRequired } from '../mode';
import { mirrorService } from './mirror';
import { slateVersionService } from './slateVersion';
import { workspaceService } from './workspace';

let maxMessageLength = 1000;

let signaturePattern = /^[A-Za-z0-9_-]{43,128}$/;

let kidPattern = /^[A-Za-z0-9_-]{43}$/;

export type MirrorImportSource =
  | { type: 'upstream'; upstream: MirrorUpstream }
  | { type: 'pack'; packImport: SlatePackImport };

export type MirrorImportCatalog = {
  name?: string | null;
  description?: string | null;
  logoUrl?: string | null;
};

type ImportOutcome = { status: MirrorResultStatus; message?: string };

let errorMessage = (error: unknown) => {
  if (error instanceof ServiceError) return error.data.message;
  if (error instanceof Error) return error.message;

  return String(error);
};

let isConflictError = (error: unknown) =>
  error instanceof ServiceError && error.data.status === 409;

class mirrorImportServiceImpl {
  async importVerifiedSlateVersion(d: {
    source: MirrorImportSource;
    identifier: string;
    version: string;
    bundle: Buffer;
    signatures: SlateVersionSignatureInput[];
    catalog?: MirrorImportCatalog;
  }) {
    let outcome = await this.importInner(d).catch((error): ImportOutcome => ({
      status: 'rejected',
      message: errorMessage(error)
    }));

    await db.mirrorResult.create({
      data: {
        ...getId('mirrorResult'),
        status: outcome.status,
        slateIdentifier: d.identifier,
        version: d.version,
        message: outcome.message?.slice(0, maxMessageLength),
        upstreamOid: d.source.type === 'upstream' ? d.source.upstream.oid : undefined,
        packImportOid: d.source.type === 'pack' ? d.source.packImport.oid : undefined
      }
    });

    return outcome;
  }

  private async importInner(d: {
    source: MirrorImportSource;
    identifier: string;
    version: string;
    bundle: Buffer;
    signatures: SlateVersionSignatureInput[];
    catalog?: MirrorImportCatalog;
  }): Promise<ImportOutcome> {
    let parsed = parseSlateFullIdentifier(d.identifier);
    if (!parsed) return { status: 'rejected', message: 'Invalid slate identifier.' };

    let entries = await readZipEntries(d.bundle);
    let slatePackage = normalizeSlatePackage({
      entries,
      identifier: {
        scopeIdentifier: parsed.scopeIdentifier,
        slateIdentifier: parsed.slateIdentifier
      }
    });
    if (slatePackage.manifest.version !== d.version) {
      return {
        status: 'rejected',
        message: `Archive contains version ${slatePackage.manifest.version}, expected ${d.version}.`
      };
    }

    let signatures = d.signatures.filter(
      signature => kidPattern.test(signature.kid) && signaturePattern.test(signature.signature)
    );

    let existing = await db.slateVersion.findFirst({
      where: { version: d.version, slate: { fullIdentifier: parsed.fullIdentifier } },
      include: { bundleArtifact: true }
    });
    if (existing) {
      if (existing.bundleArtifact.checksum !== slatePackage.contentChecksum) {
        return {
          status: 'conflict',
          message: 'This version already exists with different contents.'
        };
      }

      await this.storeSignatures({ slateVersionOid: existing.oid, signatures });
      return { status: 'skipped', message: 'This version was already imported.' };
    }

    // The checksum is recomputed from the archive, so a signature only verifies if the
    // bytes are exactly what the root registry signed.
    if (isSignatureVerificationRequired()) {
      let kid = await findValidSlateVersionSignature({
        statement: {
          identifier: parsed.fullIdentifier,
          version: d.version,
          contentChecksum: slatePackage.contentChecksum
        },
        signatures,
        trustedKeys: await mirrorService.getTrustedKeys()
      });
      if (!kid) {
        return { status: 'rejected', message: 'No valid signature from a trusted key.' };
      }
    }

    let { tenant, user } = await mirrorService.ensureContext();

    let scope = await db.scope.findFirst({ where: { identifier: parsed.scopeIdentifier } });
    if (scope && scope.tenantOid !== tenant.oid) {
      return {
        status: 'conflict',
        message: `The scope "${parsed.scopeIdentifier}" is owned by another tenant on this registry.`
      };
    }
    if (!scope) {
      await workspaceService
        .createWorkspace({
          input: { identifier: parsed.scopeIdentifier, name: parsed.scopeIdentifier },
          tenant
        })
        .catch(error => {
          if (!isConflictError(error)) throw error;
        });
    }

    let version;
    try {
      version = await slateVersionService.publishNormalizedSlateVersion({
        user,
        input: {
          access: 'private',
          backend: slatePackage.isPrebuilt ? 'local_built' : 'local_unbuilt',
          bundleBuffer: d.bundle,
          slatePackage,
          origin:
            d.source.type === 'upstream'
              ? { type: 'upstream', upstreamOid: d.source.upstream.oid }
              : { type: 'pack', packImportOid: d.source.packImport.oid }
        }
      });
    } catch (error) {
      if (isConflictError(error)) return { status: 'conflict', message: errorMessage(error) };
      throw error;
    }

    await this.storeSignatures({ slateVersionOid: version.oid, signatures });

    if (d.catalog) {
      await db.slate.update({
        where: { oid: version.slate.oid },
        data: {
          name: d.catalog.name || undefined,
          description: d.catalog.description ?? undefined,
          logoUrl: d.catalog.logoUrl ?? undefined
        }
      });
    }

    return { status: 'imported' };
  }

  private async storeSignatures(d: {
    slateVersionOid: bigint;
    signatures: SlateVersionSignatureInput[];
  }) {
    if (!d.signatures.length) return;

    await db.slateVersionSignature.createMany({
      skipDuplicates: true,
      data: d.signatures.map(signature => ({
        ...getId('slateVersionSignature'),
        kid: signature.kid,
        signature: signature.signature,
        slateVersionOid: d.slateVersionOid
      }))
    });
  }
}

export let mirrorImportService = Service.create(
  'mirrorImportService',
  () => new mirrorImportServiceImpl()
).build();
