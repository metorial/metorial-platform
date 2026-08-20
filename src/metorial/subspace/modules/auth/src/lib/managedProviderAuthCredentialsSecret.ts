import {
  parseSupportedEncryptionAadVersions,
  VersionedEncryptionKeyring
} from '@lowerdeck/encryption';
import {
  db,
  getId,
  type ManagedProviderAuthCredentialSecret,
  type ManagedProviderAuthCredentialsBackingSecret,
  type Tenant,
  type TransactionDB,
  withTransaction
} from '@metorial-subspace/db';
import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../env';
import {
  managedCredentialBackingContext,
  managedCredentialSourceContext
} from './managedProviderAuthCredentialsSecretContext';

export {
  managedCredentialBackingContext,
  managedCredentialSourceContext
} from './managedProviderAuthCredentialsSecretContext';

export let MANAGED_SECRET_PURPOSE = 'oauth_client_secret';
export let MANAGED_VENDOR_VERIFICATION_SECRET_PURPOSE = 'vendor_verification' as const;
export let MANAGED_SECRET_AAD_VERSION = 1;
export let MANAGED_SECRET_KEY_VERSION = 1;
export let MANAGED_SECRET_GRACE_MS = 24 * 60 * 60 * 1000;

export let managedCredentialSecretMigrationMetrics = {
  legacyFallbacks: 0
};
export let managedCredentialMaterialChecksum = (plaintext: string) =>
  createHash('sha256').update(plaintext).digest('hex');
let managedCredentialMaterialMatches = (left: string, right: string) => {
  let leftDigest = createHash('sha256').update(left).digest();
  let rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
};

// Managed credentials are platform-owned and deliberately have no tenant owner. Nebula's
// tenant-scoped API cannot represent that source without inventing a tenant, so this module
// uses the repository's narrower encrypted-string envelope and projects independently into
// the tenant-bound backing context below.
let getEncryption = () => {
  let keys: Record<number, string> = { 1: env.encryption.ENCRYPTION_KEY };
  if (env.encryption.ENCRYPTION_KEYRING_JSON) {
    let parsed = JSON.parse(env.encryption.ENCRYPTION_KEYRING_JSON) as Record<string, unknown>;
    for (let [version, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') throw new Error('Subspace encryption keyring is invalid');
      keys[Number(version)] = value;
    }
  }
  let activeAadVersion = env.encryption.ENCRYPTION_ACTIVE_AAD_VERSION ?? 1;
  return new VersionedEncryptionKeyring({
    keys,
    activeKeyVersion: env.encryption.ENCRYPTION_ACTIVE_KEY_VERSION ?? 1,
    supportedAadVersions: parseSupportedEncryptionAadVersions({
      configured: env.encryption.ENCRYPTION_SUPPORTED_AAD_VERSIONS,
      activeAadVersion
    })
  });
};
export let activeManagedSecretEncryptionVersions = () => ({
  encryptionKeyVersion:
    env.encryption.ENCRYPTION_ACTIVE_KEY_VERSION ?? MANAGED_SECRET_KEY_VERSION,
  aadVersion: env.encryption.ENCRYPTION_ACTIVE_AAD_VERSION ?? MANAGED_SECRET_AAD_VERSION
});
type ManagedSourceOwner = {
  oid: bigint;
  id: string;
  provider: { id: string } | null;
  initialProviderAuthMethod: { id: string; provider: { id: string } };
};
type BackingOwner = {
  oid: bigint;
  managedCredentialsOid: bigint;
  managedCredentials: { id: string };
  tenantOid: bigint;
  providerAuthCredentialsOid: bigint;
  tenant: Tenant;
  providerAuthCredentials: { id: string; status?: string };
};
type AuthTransaction = TransactionDB;

let sourceOwnerContext = (
  owner: ManagedSourceOwner,
  secret: {
    purpose: string;
    secretVersion: number;
    encryptionKeyVersion: number;
    aadVersion: number;
  }
) =>
  managedCredentialSourceContext({
    managedCredentialsId: owner.id,
    providerId: owner.initialProviderAuthMethod.provider.id,
    providerAuthMethodId: owner.initialProviderAuthMethod.id,
    ...secret
  });

let decryptSource = async (
  owner: ManagedSourceOwner,
  secret: ManagedProviderAuthCredentialSecret
) =>
  await getEncryption().decrypt({
    entityId: sourceOwnerContext(owner, secret),
    encrypted: secret.encryptedValue,
    encryptionKeyVersion: secret.encryptionKeyVersion,
    aadVersion: secret.aadVersion
  });

let decryptBacking = async (
  owner: BackingOwner,
  secret: ManagedProviderAuthCredentialsBackingSecret
) => {
  if (
    owner.tenantOid !== secret.tenantOid ||
    owner.providerAuthCredentialsOid !== secret.providerAuthCredentialsOid ||
    owner.managedCredentialsOid !== secret.managedCredentialsOid
  ) {
    throw new Error('Managed credential backing owner mismatch');
  }
  return await getEncryption().decrypt({
    entityId: managedCredentialBackingContext({
      tenantId: owner.tenant.id,
      managedCredentialsId: owner.managedCredentials.id,
      backingOid: owner.oid,
      providerAuthCredentialsId: owner.providerAuthCredentials.id,
      sourceSecretId: secret.sourceSecretId,
      sourceSecretVersion: secret.sourceSecretVersion,
      purpose: secret.purpose,
      secretVersion: secret.secretVersion,
      encryptionKeyVersion: secret.encryptionKeyVersion,
      aadVersion: secret.aadVersion
    }),
    encrypted: secret.encryptedValue,
    encryptionKeyVersion: secret.encryptionKeyVersion,
    aadVersion: secret.aadVersion
  });
};

export let resolveManagedCredentialSourcesForProjectionInTransaction = async (d: {
  tx: AuthTransaction;
  owner: ManagedSourceOwner;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let rows = await d.tx.managedProviderAuthCredentialSecret.findMany({
    where: {
      managedCredentialsOid: d.owner.oid,
      purpose: MANAGED_SECRET_PURPOSE,
      status: { in: ['active', 'retiring'] },
      validFrom: { lte: now },
      OR: [{ status: 'active' }, { status: 'retiring', validUntil: { gt: now } }]
    },
    orderBy: { secretVersion: 'desc' }
  });
  if (rows.some(row => row.status === 'retiring' && !row.validUntil)) {
    throw new Error('Retiring managed source secret requires a deadline');
  }
  return await Promise.all(
    rows.map(async secret => ({ secret, plaintext: await decryptSource(d.owner, secret) }))
  );
};

export let resolveManagedCredentialBackingSecretsInTransaction = async (d: {
  tx: AuthTransaction;
  tenantOid: bigint;
  managedCredentialsOid: bigint;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let backing = await d.tx.managedProviderAuthCredentialsBacking.findUnique({
    where: {
      managedCredentialsOid_tenantOid: {
        managedCredentialsOid: d.managedCredentialsOid,
        tenantOid: d.tenantOid
      }
    },
    include: {
      tenant: true,
      providerAuthCredentials: { select: { id: true } },
      managedCredentials: { select: { id: true } },
      secrets: {
        where: {
          purpose: MANAGED_SECRET_PURPOSE,
          status: { in: ['active', 'retiring'] },
          validFrom: { lte: now },
          OR: [{ status: 'active' }, { status: 'retiring', validUntil: { gt: now } }]
        },
        orderBy: { secretVersion: 'desc' }
      }
    }
  });
  if (!backing) throw new Error('Authoritative managed backing projection is missing');
  if (backing.secrets.some(secret => secret.status === 'retiring' && !secret.validUntil)) {
    throw new Error('Retiring managed backing secret requires a deadline');
  }
  return await Promise.all(
    backing.secrets.map(async secret => ({
      secret,
      plaintext: await decryptBacking(backing, secret)
    }))
  );
};

export let resolveManagedCredentialBackingSecretInTransaction = async (d: {
  tx: AuthTransaction;
  tenantOid: bigint;
  managedCredentialsOid: bigint;
  now?: Date;
}) => {
  let resolved = await resolveManagedCredentialBackingSecretsInTransaction(d);
  let active = resolved.find(item => item.secret.status === 'active');
  if (!active) throw new Error('Authoritative managed backing projection is missing');
  return {
    secret: active.secret,
    plaintext: active.plaintext
  };
};

export let createManagedCredentialSourceInTransaction = async (d: {
  tx: AuthTransaction;
  owner: ManagedSourceOwner;
  plaintext: string;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let active = await d.tx.managedProviderAuthCredentialSecret.findFirst({
    where: {
      managedCredentialsOid: d.owner.oid,
      purpose: MANAGED_SECRET_PURPOSE,
      status: 'active'
    }
  });
  if (active) throw new Error('Managed credential already has an active source secret');
  let id = getId('managedProviderAuthCredentials');
  let versions = activeManagedSecretEncryptionVersions();
  let encryptedValue = await getEncryption().encrypt({
    entityId: sourceOwnerContext(d.owner, {
      purpose: MANAGED_SECRET_PURPOSE,
      secretVersion: 1,
      ...versions
    }),
    secret: d.plaintext,
    ...versions
  });
  return await d.tx.managedProviderAuthCredentialSecret.create({
    data: {
      ...id,
      managedCredentialsOid: d.owner.oid,
      purpose: MANAGED_SECRET_PURPOSE,
      encryptedValue,
      secretVersion: 1,
      ...versions,
      status: 'active',
      validFrom: now
    }
  });
};

export let rotateManagedCredentialSourceInTransaction = async (d: {
  tx: AuthTransaction;
  owner: ManagedSourceOwner;
  plaintext: string;
  graceMs?: number;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let current = await d.tx.managedProviderAuthCredentialSecret.findFirst({
    where: {
      managedCredentialsOid: d.owner.oid,
      purpose: MANAGED_SECRET_PURPOSE,
      status: 'active'
    },
    orderBy: { secretVersion: 'desc' }
  });
  if (!current) return await createManagedCredentialSourceInTransaction(d);
  let validUntil = new Date(now.getTime() + (d.graceMs ?? MANAGED_SECRET_GRACE_MS));
  let retired = await d.tx.managedProviderAuthCredentialSecret.updateMany({
    where: { oid: current.oid, status: 'active' },
    data: { status: 'retiring', validUntil, rotatedAt: now }
  });
  if (retired.count !== 1) throw new Error('Managed source secret rotation conflict');
  let secretVersion = current.secretVersion + 1;
  let id = getId('managedProviderAuthCredentials');
  let versions = activeManagedSecretEncryptionVersions();
  let encryptedValue = await getEncryption().encrypt({
    entityId: sourceOwnerContext(d.owner, {
      purpose: MANAGED_SECRET_PURPOSE,
      secretVersion,
      ...versions
    }),
    secret: d.plaintext,
    ...versions
  });
  return await d.tx.managedProviderAuthCredentialSecret.create({
    data: {
      ...id,
      managedCredentialsOid: d.owner.oid,
      purpose: MANAGED_SECRET_PURPOSE,
      encryptedValue,
      secretVersion,
      ...versions,
      status: 'active',
      validFrom: now
    }
  });
};

/** Closed producer for provisioned-app verification material. It deliberately does not
 * share the oauth_client_secret resolver or namespace. The target backing ID/version is
 * server-generated on the authoritative binding before this producer is called. */
export let createOrRotateManagedVendorVerificationSecretInTransaction = async (d: {
  tx: AuthTransaction;
  owner: ManagedSourceOwner;
  backing: BackingOwner;
  plaintext: string;
  expectedSecretId: string;
  expectedSecretVersion: number;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let purpose = MANAGED_VENDOR_VERIFICATION_SECRET_PURPOSE;
  if (!d.plaintext || !d.expectedSecretId || d.expectedSecretVersion <= 0) {
    throw new Error('Managed vendor-verification secret input is invalid');
  }
  if (
    d.backing.managedCredentialsOid !== d.owner.oid ||
    d.backing.tenantOid <= 0n ||
    d.backing.providerAuthCredentialsOid <= 0n
  ) {
    throw new Error('Managed vendor-verification backing owner mismatch');
  }
  let currentBacking = await d.tx.managedProviderAuthCredentialsBackingSecret.findFirst({
    where: { managedCredentialsBackingOid: d.backing.oid, purpose },
    orderBy: { secretVersion: 'desc' }
  });
  if (
    currentBacking?.id === d.expectedSecretId &&
    currentBacking.secretVersion === d.expectedSecretVersion &&
    currentBacking.status === 'active'
  ) {
    let existing = await decryptBacking(d.backing, currentBacking);
    if (!managedCredentialMaterialMatches(existing, d.plaintext)) {
      throw new Error('Managed vendor-verification retry material does not match');
    }
    return { secret: currentBacking, idempotent: true as const };
  }
  if (currentBacking && d.expectedSecretVersion !== currentBacking.secretVersion + 1) {
    throw new Error('Managed vendor-verification secret generation is stale');
  }

  let currentSource = await d.tx.managedProviderAuthCredentialSecret.findFirst({
    where: { managedCredentialsOid: d.owner.oid, purpose },
    orderBy: { secretVersion: 'desc' }
  });
  let sourceSecretVersion = currentSource
    ? currentSource.secretVersion + 1
    : d.expectedSecretVersion;
  if (currentSource?.status === 'active') {
    let retired = await d.tx.managedProviderAuthCredentialSecret.updateMany({
      where: { oid: currentSource.oid, status: 'active' },
      data: {
        status: 'retiring',
        validUntil: new Date(now.getTime() + MANAGED_SECRET_GRACE_MS),
        rotatedAt: now
      }
    });
    if (retired.count !== 1) throw new Error('Managed verification source rotation conflict');
  }
  let sourceId = getId('managedProviderAuthCredentials');
  let versions = activeManagedSecretEncryptionVersions();
  let sourceEncryptedValue = await getEncryption().encrypt({
    entityId: sourceOwnerContext(d.owner, {
      purpose,
      secretVersion: sourceSecretVersion,
      ...versions
    }),
    secret: d.plaintext,
    ...versions
  });
  let source = await d.tx.managedProviderAuthCredentialSecret.create({
    data: {
      ...sourceId,
      managedCredentialsOid: d.owner.oid,
      purpose,
      encryptedValue: sourceEncryptedValue,
      secretVersion: sourceSecretVersion,
      ...versions,
      status: 'active',
      validFrom: now
    }
  });

  if (currentBacking?.status === 'active') {
    let retired = await d.tx.managedProviderAuthCredentialsBackingSecret.updateMany({
      where: { oid: currentBacking.oid, status: 'active' },
      data: {
        status: 'retiring',
        validUntil: new Date(now.getTime() + MANAGED_SECRET_GRACE_MS),
        rotatedAt: now
      }
    });
    if (retired.count !== 1) throw new Error('Managed verification backing rotation conflict');
  }
  let backingId = getId('providerAuthCredentials');
  let encryptedValue = await getEncryption().encrypt({
    entityId: managedCredentialBackingContext({
      tenantId: d.backing.tenant.id,
      managedCredentialsId: d.backing.managedCredentials.id,
      backingOid: d.backing.oid,
      providerAuthCredentialsId: d.backing.providerAuthCredentials.id,
      sourceSecretId: source.id,
      sourceSecretVersion: source.secretVersion,
      purpose,
      secretVersion: d.expectedSecretVersion,
      ...versions
    }),
    secret: d.plaintext,
    ...versions
  });
  let secret = await d.tx.managedProviderAuthCredentialsBackingSecret.create({
    data: {
      oid: backingId.oid,
      id: d.expectedSecretId,
      managedCredentialsBackingOid: d.backing.oid,
      tenantOid: d.backing.tenantOid,
      providerAuthCredentialsOid: d.backing.providerAuthCredentialsOid,
      managedCredentialsOid: d.owner.oid,
      sourceSecretId: source.id,
      sourceSecretVersion: source.secretVersion,
      purpose,
      encryptedValue,
      secretVersion: d.expectedSecretVersion,
      ...versions,
      status: 'active',
      validFrom: now
    }
  });
  await d.tx.managedProviderAuthCredentialsBacking.update({
    where: { oid: d.backing.oid },
    data: { updatedAt: now }
  });
  return { secret, idempotent: false as const };
};

export let revokeManagedVendorVerificationSecretInTransaction = async (d: {
  tx: AuthTransaction;
  backingOid: bigint;
  tenantOid: bigint;
  managedCredentialsOid: bigint;
  providerAuthCredentialsOid: bigint;
  secretId: string;
  secretVersion: number;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let secret = await d.tx.managedProviderAuthCredentialsBackingSecret.findFirst({
    where: {
      id: d.secretId,
      secretVersion: d.secretVersion,
      purpose: MANAGED_VENDOR_VERIFICATION_SECRET_PURPOSE,
      managedCredentialsBackingOid: d.backingOid,
      tenantOid: d.tenantOid,
      managedCredentialsOid: d.managedCredentialsOid,
      providerAuthCredentialsOid: d.providerAuthCredentialsOid
    }
  });
  if (!secret) throw new Error('Managed vendor-verification secret was not found');
  if (secret.status === 'revoked') return { secret, idempotent: true as const };
  let revoked = await d.tx.managedProviderAuthCredentialsBackingSecret.update({
    where: { oid: secret.oid },
    data: { status: 'revoked', validUntil: now, revokedAt: now }
  });
  return { secret: revoked, idempotent: false as const };
};

/** Reconciles rollback-era legacy writes into the authoritative encrypted source.
 * The caller must keep this operation and all backing projections in one transaction. */
export let reconcileManagedCredentialLegacySourceInTransaction = async (d: {
  tx: AuthTransaction;
  owner: ManagedSourceOwner;
  legacyPlaintext: string;
  graceMs?: number;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let resolved = await resolveManagedCredentialSourcesForProjectionInTransaction({
    tx: d.tx,
    owner: d.owner,
    now
  });
  let active = resolved.filter(item => item.secret.status === 'active');
  if (active.length > 1) throw new Error('Managed credential has duplicate active sources');
  if (active.length === 0) {
    return await createManagedCredentialSourceInTransaction({
      tx: d.tx,
      owner: d.owner,
      plaintext: d.legacyPlaintext,
      now
    });
  }
  if (managedCredentialMaterialMatches(active[0]!.plaintext, d.legacyPlaintext)) {
    return active[0]!.secret;
  }
  return await rotateManagedCredentialSourceInTransaction({
    tx: d.tx,
    owner: d.owner,
    plaintext: d.legacyPlaintext,
    graceMs: d.graceMs,
    now
  });
};

/** Trusted reconciliation boundary: this is the only function that decrypts a
 * platform source and it immediately re-encrypts into the exact backing context. */
export let projectManagedCredentialSourceIntoBackingInTransaction = async (d: {
  tx: AuthTransaction;
  owner: ManagedSourceOwner;
  backing: BackingOwner;
  source: ManagedProviderAuthCredentialSecret;
  graceMs?: number;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  if (d.source.status !== 'active' || d.source.managedCredentialsOid !== d.owner.oid) {
    throw new Error('Only the authoritative active source may be projected');
  }
  if (d.backing.managedCredentialsOid !== d.owner.oid) {
    throw new Error('Managed credential backing source owner mismatch');
  }
  let current = await d.tx.managedProviderAuthCredentialsBackingSecret.findFirst({
    where: {
      managedCredentialsBackingOid: d.backing.oid,
      purpose: MANAGED_SECRET_PURPOSE,
      status: 'active'
    },
    orderBy: { secretVersion: 'desc' }
  });
  if (
    current?.sourceSecretVersion === d.source.secretVersion &&
    current.sourceSecretId === d.source.id
  ) {
    await d.tx.managedProviderAuthCredentialsBacking.update({
      where: { oid: d.backing.oid },
      data: { updatedAt: now }
    });
    return current;
  }
  if (current && current.sourceSecretVersion > d.source.secretVersion)
    throw new Error('Stale managed source projection rejected');
  let plaintext = await decryptSource(d.owner, d.source);
  if (current) {
    let validUntil = new Date(now.getTime() + (d.graceMs ?? MANAGED_SECRET_GRACE_MS));
    let retired = await d.tx.managedProviderAuthCredentialsBackingSecret.updateMany({
      where: { oid: current.oid, status: 'active' },
      data: { status: 'retiring', validUntil, rotatedAt: now }
    });
    if (retired.count !== 1) throw new Error('Managed backing projection conflict');
  }
  let secretVersion = (current?.secretVersion ?? 0) + 1;
  let id = getId('providerAuthCredentials');
  let versions = activeManagedSecretEncryptionVersions();
  let encryptedValue = await getEncryption().encrypt({
    entityId: managedCredentialBackingContext({
      tenantId: d.backing.tenant.id,
      managedCredentialsId: d.backing.managedCredentials.id,
      backingOid: d.backing.oid,
      providerAuthCredentialsId: d.backing.providerAuthCredentials.id,
      sourceSecretId: d.source.id,
      sourceSecretVersion: d.source.secretVersion,
      purpose: MANAGED_SECRET_PURPOSE,
      secretVersion,
      ...versions
    }),
    secret: plaintext,
    ...versions
  });
  let projected = await d.tx.managedProviderAuthCredentialsBackingSecret.create({
    data: {
      ...id,
      managedCredentialsBackingOid: d.backing.oid,
      tenantOid: d.backing.tenantOid,
      providerAuthCredentialsOid: d.backing.providerAuthCredentialsOid,
      managedCredentialsOid: d.owner.oid,
      sourceSecretId: d.source.id,
      sourceSecretVersion: d.source.secretVersion,
      purpose: MANAGED_SECRET_PURPOSE,
      encryptedValue,
      secretVersion,
      ...versions,
      status: 'active',
      validFrom: now
    }
  });
  await d.tx.managedProviderAuthCredentialsBacking.update({
    where: { oid: d.backing.oid },
    data: { updatedAt: now }
  });
  return projected;
};

export let reconcileManagedCredentialLegacyBackingsInTransaction = async (d: {
  tx: AuthTransaction;
  owner: ManagedSourceOwner;
  backings: BackingOwner[];
  legacyPlaintext: string;
  now?: Date;
  failureInjection?: {
    afterProjection?: (d: { backingOid: bigint; projectionIndex: number }) => Promise<void>;
  };
}) => {
  let now = d.now ?? new Date();
  let source = await reconcileManagedCredentialLegacySourceInTransaction({
    tx: d.tx,
    owner: d.owner,
    legacyPlaintext: d.legacyPlaintext,
    now
  });
  let liveBackings = d.backings.filter(
    backing => backing.providerAuthCredentials.status === 'active'
  );
  for (let [projectionIndex, backing] of liveBackings.entries()) {
    await projectManagedCredentialSourceIntoBackingInTransaction({
      tx: d.tx,
      owner: d.owner,
      backing,
      source,
      now
    });
    await d.failureInjection?.afterProjection?.({
      backingOid: backing.oid,
      projectionIndex
    });
  }
  let resolvedSources = await resolveManagedCredentialSourcesForProjectionInTransaction({
    tx: d.tx,
    owner: d.owner,
    now
  });
  let resolvedSource = resolvedSources.find(item => item.secret.status === 'active');
  if (
    !resolvedSource ||
    resolvedSource.secret.id !== source.id ||
    !managedCredentialMaterialMatches(resolvedSource.plaintext, d.legacyPlaintext)
  ) {
    throw new Error('Managed credential source reconciliation verification drift');
  }
  let resolvedBackings = [];
  for (let backing of liveBackings) {
    let resolved = await resolveManagedCredentialBackingSecretInTransaction({
      tx: d.tx,
      tenantOid: backing.tenantOid,
      managedCredentialsOid: d.owner.oid,
      now
    });
    if (
      resolved.secret.sourceSecretId !== source.id ||
      resolved.secret.sourceSecretVersion !== source.secretVersion ||
      !managedCredentialMaterialMatches(resolved.plaintext, resolvedSource.plaintext)
    ) {
      throw new Error('Managed credential backing reconciliation verification drift');
    }
    resolvedBackings.push(resolved);
  }
  return { source, resolvedSource, resolvedBackings, liveBackings };
};

/** Trusted reconciliation entry point. Workload consumers must call only the backing
 * resolver below; this function alone is permitted to select and decrypt a platform source. */
export let reconcileManagedCredentialBackingProjection = async (d: {
  tenantOid: bigint;
  managedCredentialsOid: bigint;
}) =>
  await withTransaction(async tx => {
    let owner = await tx.managedProviderAuthCredentials.findUniqueOrThrow({
      where: { oid: d.managedCredentialsOid },
      include: {
        provider: true,
        initialProviderAuthMethod: { include: { provider: true } }
      }
    });
    let backing = await tx.managedProviderAuthCredentialsBacking.findUnique({
      where: {
        managedCredentialsOid_tenantOid: {
          managedCredentialsOid: d.managedCredentialsOid,
          tenantOid: d.tenantOid
        }
      },
      include: {
        tenant: true,
        managedCredentials: { select: { id: true } },
        providerAuthCredentials: { select: { id: true } }
      }
    });
    if (!backing) return null;
    let sources = await resolveManagedCredentialSourcesForProjectionInTransaction({
      tx,
      owner
    });
    let source = sources.find(candidate => candidate.secret.status === 'active')?.secret;
    if (!source) throw new Error('Authoritative managed source is unavailable');
    return await projectManagedCredentialSourceIntoBackingInTransaction({
      tx,
      owner,
      backing,
      source
    });
  });

/** Workload boundary: resolves only a tenant-owned backing. It has no source
 * resolver/decrypt capability. Legacy fallback is metered during migration. */
export let resolveManagedCredentialBackingSecret = async (d: {
  tenant: Tenant;
  managedCredentialsOid: bigint;
}) => {
  let backing = await db.managedProviderAuthCredentialsBacking.findUnique({
    where: {
      managedCredentialsOid_tenantOid: {
        managedCredentialsOid: d.managedCredentialsOid,
        tenantOid: d.tenant.oid
      }
    },
    include: {
      tenant: true,
      providerAuthCredentials: { select: { id: true } },
      managedCredentials: { select: { id: true } },
      secrets: {
        where: { purpose: MANAGED_SECRET_PURPOSE },
        orderBy: { secretVersion: 'desc' }
      }
    }
  });
  if (!backing || backing.secrets.length === 0) {
    managedCredentialSecretMigrationMetrics.legacyFallbacks += 1;
    return {
      state: 'not_migrated' as const,
      legacyFallback: true as const,
      backing
    };
  }
  let candidates = backing.secrets.filter(
    candidate =>
      candidate.status === 'active' &&
      candidate.validFrom <= new Date() &&
      candidate.managedCredentialsOid === d.managedCredentialsOid
  );
  if (candidates.length !== 1) {
    throw new Error('Managed credential encrypted backing state is not readable');
  }
  let secret = candidates[0];
  if (!secret) {
    throw new Error('Managed credential encrypted backing state is not readable');
  }
  return {
    state: 'encrypted' as const,
    plaintext: await decryptBacking(backing, secret),
    legacyFallback: false as const,
    sourceSecretId: secret.sourceSecretId,
    sourceSecretVersion: secret.sourceSecretVersion
  };
};

export let assertManagedSourceRevocable = async (d: {
  tx?: AuthTransaction;
  managedCredentialsOid: bigint;
  sourceSecretId: string;
  sourceSecretVersion: number;
}) => {
  let store = d.tx ?? db;
  let liveBackings = await store.managedProviderAuthCredentialsBacking.count({
    where: {
      managedCredentialsOid: d.managedCredentialsOid,
      providerAuthCredentials: { status: 'active' }
    }
  });
  let projected = await store.managedProviderAuthCredentialsBackingSecret.count({
    where: {
      managedCredentialsBacking: {
        managedCredentialsOid: d.managedCredentialsOid,
        providerAuthCredentials: { status: 'active' }
      },
      sourceSecretId: d.sourceSecretId,
      sourceSecretVersion: d.sourceSecretVersion,
      status: 'active'
    }
  });
  if (projected !== liveBackings)
    throw new Error('Managed source cannot be revoked before every live backing is projected');
};

export let reencryptManagedBackingInTransaction = async (d: {
  tx: AuthTransaction;
  backing: BackingOwner;
  secret: ManagedProviderAuthCredentialsBackingSecret;
  encryptionKeyVersion: number;
  aadVersion: number;
}) => {
  let plaintext = await decryptBacking(d.backing, d.secret);
  let encryptedValue = await getEncryption().encrypt({
    entityId: managedCredentialBackingContext({
      tenantId: d.backing.tenant.id,
      managedCredentialsId: d.backing.managedCredentials.id,
      backingOid: d.backing.oid,
      providerAuthCredentialsId: d.backing.providerAuthCredentials.id,
      sourceSecretId: d.secret.sourceSecretId,
      sourceSecretVersion: d.secret.sourceSecretVersion,
      purpose: d.secret.purpose,
      secretVersion: d.secret.secretVersion,
      encryptionKeyVersion: d.encryptionKeyVersion,
      aadVersion: d.aadVersion
    }),
    secret: plaintext,
    encryptionKeyVersion: d.encryptionKeyVersion,
    aadVersion: d.aadVersion
  });
  return await d.tx.managedProviderAuthCredentialsBackingSecret.update({
    where: { oid: d.secret.oid },
    data: {
      encryptedValue,
      encryptionKeyVersion: d.encryptionKeyVersion,
      aadVersion: d.aadVersion
    }
  });
};

export let reencryptManagedSourceInTransaction = async (d: {
  tx: AuthTransaction;
  owner: ManagedSourceOwner;
  secret: ManagedProviderAuthCredentialSecret;
  encryptionKeyVersion: number;
  aadVersion: number;
}) => {
  let plaintext = await decryptSource(d.owner, d.secret);
  let encryptedValue = await getEncryption().encrypt({
    entityId: sourceOwnerContext(d.owner, {
      purpose: d.secret.purpose,
      secretVersion: d.secret.secretVersion,
      encryptionKeyVersion: d.encryptionKeyVersion,
      aadVersion: d.aadVersion
    }),
    secret: plaintext,
    encryptionKeyVersion: d.encryptionKeyVersion,
    aadVersion: d.aadVersion
  });
  return await d.tx.managedProviderAuthCredentialSecret.update({
    where: { oid: d.secret.oid },
    data: {
      encryptedValue,
      encryptionKeyVersion: d.encryptionKeyVersion,
      aadVersion: d.aadVersion
    }
  });
};
