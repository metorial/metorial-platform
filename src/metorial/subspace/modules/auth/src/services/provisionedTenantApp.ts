import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  type Prisma,
  type ProvisionedTenantAppCredentialOwnerType,
  type Solution,
  type TransactionDB,
  withTransaction
} from '@metorial-subspace/db';
import { env } from '../env';
import {
  createOrRotateManagedVendorVerificationSecretInTransaction,
  revokeManagedVendorVerificationSecretInTransaction
} from '../lib/managedProviderAuthCredentialsSecret';

export let PROVISIONED_APP_TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export let GITHUB_MANIFEST_STATE_TTL_MS = 10 * 60 * 1000;
export let PROVISIONED_TENANT_APP_SECRET_PURPOSE = 'vendor_verification' as const;

export let assertSlackManagerAppProvisioningEnabled = () => {
  if (env.service.SLACK_MANAGER_APP_PROVISIONING_ENABLED !== true) {
    fail(
      'slack_manager_app_capability_unconfirmed',
      'Slack manager-app provisioning is disabled; use BYO app provisioning'
    );
  }
};

export class ProvisionedTenantAppError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ProvisionedTenantAppError';
  }
}

function fail(code: string, message: string): never {
  throw new ProvisionedTenantAppError(code, message);
}

let normalizeVendor = (vendor: string) => vendor.trim().toLowerCase();
let canonicalValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)])
    );
  }
  return value;
};

export let canonicalProvisionedProjection = (value: unknown) =>
  JSON.stringify(canonicalValue(value));
export let digestProvisionedProjection = (value: unknown) =>
  `sha256:${createHash('sha256').update(canonicalProvisionedProjection(value)).digest('hex')}`;

export let hashGithubManifestState = (state: string) =>
  createHash('sha256').update(state).digest('hex');

export let assertGithubManifestState = (d: {
  presentedState: string;
  storedStateHash: string | null;
  expiresAt: Date | null;
  now?: Date;
}) => {
  let actual = Buffer.from(hashGithubManifestState(d.presentedState), 'hex');
  let expected = d.storedStateHash ? Buffer.from(d.storedStateHash, 'hex') : Buffer.alloc(0);
  if (
    !d.expiresAt ||
    d.expiresAt <= (d.now ?? new Date()) ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    fail('github_manifest_state_invalid', 'GitHub manifest state is invalid or expired');
  }
};

let lengthPrefix = (value: string) => `${Buffer.byteLength(value, 'utf8')}:${value}`;
export let buildProvisionedExternalOwnershipKey = (d: {
  vendor: string;
  externalAppId?: string | null;
  externalAccountId?: string | null;
  externalInstallationId?: string | null;
}) => {
  let identities = [
    ['app', d.externalAppId],
    ['account', d.externalAccountId],
    ['installation', d.externalInstallationId]
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (identities.length === 0) {
    fail('external_identity_missing', 'An immutable external identity is required');
  }
  let material = [
    'provisioned-external-owner/v1',
    normalizeVendor(d.vendor),
    ...identities.flatMap(([kind, value]) => [kind, value])
  ]
    .map(lengthPrefix)
    .join('|');
  return `peo1:${createHash('sha256').update(material).digest('hex')}`;
};

export let assertProvisionedCredentialOwnerShape = (d: {
  credentialOwnerType: ProvisionedTenantAppCredentialOwnerType;
  managedCredentialsOid?: bigint | null;
}) => {
  if (d.credentialOwnerType === 'managed' && d.managedCredentialsOid == null) {
    fail('managed_owner_missing', 'Managed provisioning requires a managed owner');
  }
  if (d.credentialOwnerType === 'byo' && d.managedCredentialsOid != null) {
    fail('byo_owner_must_not_be_managed', 'BYO provisioning cannot use a managed owner');
  }
};

export let assertResolvedProvisionedCredentialAuthority = (d: {
  credentialOwnerType: ProvisionedTenantAppCredentialOwnerType;
  tenantOid: bigint;
  vendor: string;
  managedCredentialsOid: bigint | null;
  credentialOwnerRef: string;
  credentialSecretId: string;
  credentialSecretPurpose: string;
  credentialVersion: number;
  now: Date;
  resolved: {
    ownerExists: boolean;
    ownerActive: boolean;
    ownerIsTenantOwned: boolean;
    ownerRef: string | null;
    ownerTenantOid: bigint | null;
    managedCredentialsOid: bigint | null;
    bindingTenantOid: bigint | null;
    vendor: string | null;
    secretId: string | null;
    secretPurpose: string | null;
    secretVersion: number | null;
    secretStatus: string | null;
    secretTenantOid: bigint | null;
    secretValidFrom: Date | null;
    secretValidUntil: Date | null;
    secretOwnerMatches: boolean;
  };
}) => {
  assertProvisionedCredentialOwnerShape(d);
  let ownerTenantMatches =
    d.credentialOwnerType === 'managed'
      ? d.resolved.managedCredentialsOid === d.managedCredentialsOid &&
        d.resolved.bindingTenantOid === d.tenantOid
      : d.resolved.ownerIsTenantOwned &&
        d.resolved.ownerTenantOid === d.tenantOid &&
        d.resolved.managedCredentialsOid === null;
  let valid =
    d.resolved.ownerExists &&
    d.resolved.ownerActive &&
    ownerTenantMatches &&
    d.resolved.ownerRef === d.credentialOwnerRef &&
    d.resolved.vendor !== null &&
    normalizeVendor(d.resolved.vendor) === normalizeVendor(d.vendor) &&
    d.resolved.secretId === d.credentialSecretId &&
    d.resolved.secretPurpose === d.credentialSecretPurpose &&
    d.resolved.secretVersion === d.credentialVersion &&
    d.resolved.secretStatus === 'active' &&
    d.resolved.secretTenantOid === d.tenantOid &&
    d.resolved.secretValidFrom !== null &&
    d.resolved.secretValidFrom <= d.now &&
    (d.resolved.secretValidUntil === null || d.resolved.secretValidUntil > d.now) &&
    d.resolved.secretOwnerMatches;
  if (!valid) {
    fail(
      d.credentialOwnerType === 'managed'
        ? 'managed_credential_authority_mismatch'
        : 'byo_credential_authority_mismatch',
      `${d.credentialOwnerType === 'managed' ? 'Managed' : 'BYO'} credential owner, tenant, vendor, or secret binding is invalid`
    );
  }
};

export type ProvisionedRouteProjectionV1 = {
  version: 1;
  entityKind: 'route';
  provisionedRouteId: string;
  routeIdentifier: string;
  vendor: string;
  purpose: string;
  credentialOwnerRef: string;
  generation: number;
  routeSecretId: string;
  routeSecretVersion: number;
  vendorVerificationSecretId: string;
  vendorVerificationVersion: number;
  status: string;
  tombstone: boolean;
  tombstoneRetainUntil: string | null;
  expiresAt: string | null;
};

export type ProvisionedBindingProjectionV1 = {
  version: 1;
  entityKind: 'binding';
  provisionedTenantAppId: string;
  provisionedRouteId: string;
  routeIdentifier: string;
  routeGeneration: number;
  hubTenantId: string;
  callbackInstanceId: string;
  hubReceiverId: string;
  hubReceiverGeneration: number;
  hubReceiverTriggerId: string;
  triggerActionId: string;
  triggerSpecHash: string;
  vendor: string;
  purpose: string;
  externalAppId: string | null;
  externalAccountId: string | null;
  externalInstallationId: string | null;
  externalOwnershipKey: string | null;
  ownerIdentity: string | null;
  credentialOwnerType: ProvisionedTenantAppCredentialOwnerType;
  credentialOwnerRef: string;
  credentialSecretId: string | null;
  credentialSecretPurpose: typeof PROVISIONED_TENANT_APP_SECRET_PURPOSE;
  credentialVersion: number;
  generation: number;
  status: string;
  tombstone: boolean;
  tombstoneRetainUntil: string | null;
  expiresAt: string | null;
};

type RouteProjectionSource = {
  id: string;
  routeIdentifier: string;
  vendor: string;
  purpose: string;
  credentialOwnerRef: string;
  generation: number;
  routeSecretId: string;
  routeSecretVersion: number;
  vendorVerificationSecretId: string;
  vendorVerificationVersion: number;
  status: string;
  expiresAt: Date | null;
  deletedAt: Date | null;
};

type BindingProjectionSource = {
  id: string;
  hubReceiverId: string;
  hubReceiverGeneration: number;
  hubReceiverTriggerId: string;
  triggerActionId: string;
  triggerSpecHash: string;
  vendor: string;
  purpose: string;
  externalAppId: string | null;
  externalAccountId: string | null;
  externalInstallationId: string | null;
  externalOwnershipKey: string | null;
  retainedExternalOwnershipKey?: string | null;
  ownerIdentity: string | null;
  credentialOwnerType: ProvisionedTenantAppCredentialOwnerType;
  credentialOwnerRef: string;
  credentialSecretId: string | null;
  credentialSecretPurpose: string;
  credentialVersion: number;
  generation: number;
  status: string;
  expiresAt: Date | null;
  deletedAt: Date | null;
  tenant: { slateTenantId: string | null };
  callbackInstance: { id: string };
  vendorAppRoute: RouteProjectionSource;
};

let tombstoneRetainUntil = (deletedAt: Date | null) =>
  deletedAt
    ? new Date(deletedAt.getTime() + PROVISIONED_APP_TOMBSTONE_RETENTION_MS).toISOString()
    : null;

export let buildProvisionedRouteProjection = (
  route: RouteProjectionSource
): ProvisionedRouteProjectionV1 => ({
  version: 1,
  entityKind: 'route',
  provisionedRouteId: route.id,
  routeIdentifier: route.routeIdentifier,
  vendor: route.vendor,
  purpose: route.purpose,
  credentialOwnerRef: route.credentialOwnerRef,
  generation: route.generation,
  routeSecretId: route.routeSecretId,
  routeSecretVersion: route.routeSecretVersion,
  vendorVerificationSecretId: route.vendorVerificationSecretId,
  vendorVerificationVersion: route.vendorVerificationVersion,
  status: route.status,
  tombstone: route.deletedAt !== null,
  tombstoneRetainUntil: tombstoneRetainUntil(route.deletedAt),
  expiresAt: route.expiresAt?.toISOString() ?? null
});

export let buildProvisionedBindingProjection = (
  binding: BindingProjectionSource
): ProvisionedBindingProjectionV1 => {
  if (!binding.tenant.slateTenantId) {
    fail('hub_tenant_not_projected', 'Tenant has no authoritative Hub identity');
  }
  if (binding.credentialSecretPurpose !== PROVISIONED_TENANT_APP_SECRET_PURPOSE) {
    fail('credential_secret_purpose_invalid', 'Provisioning secret purpose is invalid');
  }
  return {
    version: 1,
    entityKind: 'binding',
    provisionedTenantAppId: binding.id,
    provisionedRouteId: binding.vendorAppRoute.id,
    routeIdentifier: binding.vendorAppRoute.routeIdentifier,
    routeGeneration: binding.vendorAppRoute.generation,
    hubTenantId: binding.tenant.slateTenantId,
    callbackInstanceId: binding.callbackInstance.id,
    hubReceiverId: binding.hubReceiverId,
    hubReceiverGeneration: binding.hubReceiverGeneration,
    hubReceiverTriggerId: binding.hubReceiverTriggerId,
    triggerActionId: binding.triggerActionId,
    triggerSpecHash: binding.triggerSpecHash,
    vendor: binding.vendor,
    purpose: binding.purpose,
    externalAppId: binding.externalAppId,
    externalAccountId: binding.externalAccountId,
    externalInstallationId: binding.externalInstallationId,
    externalOwnershipKey:
      binding.externalOwnershipKey ?? binding.retainedExternalOwnershipKey ?? null,
    ownerIdentity: binding.ownerIdentity,
    credentialOwnerType: binding.credentialOwnerType,
    credentialOwnerRef: binding.credentialOwnerRef,
    credentialSecretId: binding.credentialSecretId,
    credentialSecretPurpose: binding.credentialSecretPurpose,
    credentialVersion: binding.credentialVersion,
    generation: binding.generation,
    status: binding.status,
    tombstone: binding.deletedAt !== null,
    tombstoneRetainUntil: tombstoneRetainUntil(binding.deletedAt),
    expiresAt: binding.expiresAt?.toISOString() ?? null
  };
};

type Projection = ProvisionedRouteProjectionV1 | ProvisionedBindingProjectionV1;
let createProjectionOutbox = async (
  tx: TransactionDB,
  projection: Projection,
  correlationId: string = randomUUID()
) => {
  let projectionDigest = digestProvisionedProjection(projection);
  let entityId =
    projection.entityKind === 'route'
      ? projection.provisionedRouteId
      : projection.provisionedTenantAppId;
  let id = getId('provisionedAppProjectionOutbox');
  let row = await tx.provisionedAppProjectionOutbox.create({
    data: {
      ...id,
      entityKind: projection.entityKind,
      entityId,
      generation: projection.generation,
      projectionDigest,
      correlationId,
      idempotencyKey: `provisioned-projection/v1:${projection.entityKind}:${entityId}:${projection.generation}:${projectionDigest}`,
      tombstone: projection.tombstone,
      payload: projection as Prisma.InputJsonValue
    }
  });
  await addAfterTransactionHook(async () => {
    let { provisionTenantAppProjectionQueue } =
      await import('../queues/lifecycle/provisionTenantApp');
    await provisionTenantAppProjectionQueue.add(
      { outboxId: row.id },
      { id: `provisioned-projection-${row.id}` }
    );
  });
  return { row, projectionDigest };
};

export type VerifiedProvisionedExternalOwnership = {
  externalAppId?: string;
  externalAccountId?: string;
  externalInstallationId?: string;
  ownerIdentity?: string;
};

export interface ProvisionedExternalOwnershipVerifier {
  verify(d: {
    vendor: string;
    proof: Record<string, unknown>;
    expectedAppId?: string | null;
  }): Promise<VerifiedProvisionedExternalOwnership>;
}

export interface GithubManifestProvisioner {
  getManifestRedirectUrl(d: { state: string; provisionedTenantAppId: string }): string;
  exchangeManifestCode(d: {
    code: string;
    state: string;
    provisionedTenantAppId: string;
  }): Promise<{
    externalAppId: string;
    ownerIdentity: string;
  }>;
  resolveInstallation(d: { installationCode: string; expectedAppId: string }): Promise<{
    externalAppId: string;
    externalInstallationId: string;
    externalAccountId?: string;
    ownerIdentity: string;
  }>;
}

export interface ProvisionedByoCredentialSecretAuthorityResolver {
  validate(d: {
    provisionedTenantAppId: string;
    hubTenantId: string;
    callbackInstanceId: string;
    provisionedRouteId: string;
    routeGeneration: number;
    vendor: string;
    credentialOwnerRef: string;
    credentialSecretId: string;
    credentialSecretPurpose: typeof PROVISIONED_TENANT_APP_SECRET_PURPOSE;
    credentialVersion: number;
    hubReceiverId: string;
    hubReceiverGeneration: number;
    hubReceiverTriggerId: string;
    triggerActionId: string;
    triggerSpecHash: string;
  }): Promise<{ valid: true }>;
  createOrRotate(d: { provisionedTenantAppId: string; importedValue: string }): Promise<{
    secret: { id: string; status: string; secretVersion: number };
    auditCorrelationId: string | null;
    idempotent: boolean;
    secretIssuanceReceipt: null;
  }>;
  revoke(d: { provisionedTenantAppId: string }): Promise<{
    secret: { id: string; status: string; secretVersion: number };
    auditCorrelationId: string | null;
    idempotent: boolean;
    secretIssuanceReceipt: null;
  }>;
}

let externalOwnershipVerifier: ProvisionedExternalOwnershipVerifier | null = null;
let githubManifestProvisioner: GithubManifestProvisioner | null = null;
let byoCredentialSecretAuthorityResolver: ProvisionedByoCredentialSecretAuthorityResolver | null =
  null;
export let configureProvisionedExternalOwnershipVerifier = (
  verifier: ProvisionedExternalOwnershipVerifier | null
) => {
  externalOwnershipVerifier = verifier;
};
export let configureGithubManifestProvisioner = (
  provisioner: GithubManifestProvisioner | null
) => {
  githubManifestProvisioner = provisioner;
};
export let configureProvisionedByoCredentialSecretAuthorityResolver = (
  resolver: ProvisionedByoCredentialSecretAuthorityResolver | null
) => {
  byoCredentialSecretAuthorityResolver = resolver;
};

let bindingInclude = {
  tenant: true,
  callbackInstance: true,
  vendorAppRoute: true
} as const;

let assertSecretReference = (id: string | null | undefined, version: number) => {
  if (!id || !Number.isInteger(version) || version <= 0) {
    fail('credential_secret_invalid', 'An opaque, versioned credential secret is required');
  }
};

export let resolveProvisionedCredentialOwner = async (d: {
  tx: TransactionDB;
  tenantOid: bigint;
  vendor: string;
  credentialOwnerType: ProvisionedTenantAppCredentialOwnerType;
  managedCredentialsOid: bigint | null;
  credentialOwnerRef: string;
  credentialSecretId: string | null;
  credentialSecretPurpose: string;
  credentialVersion: number;
  provisionedTenantAppId: string;
  hubTenantId: string;
  callbackInstanceId: string;
  provisionedRouteId: string;
  routeGeneration: number;
  hubReceiverId: string;
  hubReceiverGeneration: number;
  hubReceiverTriggerId: string;
  triggerActionId: string;
  triggerSpecHash: string;
  now: Date;
}) => {
  assertProvisionedCredentialOwnerShape(d);
  assertSecretReference(d.credentialSecretId, d.credentialVersion);
  if (d.credentialSecretPurpose !== PROVISIONED_TENANT_APP_SECRET_PURPOSE) {
    fail('credential_secret_purpose_invalid', 'Provisioning secret purpose is invalid');
  }
  if (d.credentialOwnerType === 'managed') {
    let owner = await d.tx.managedProviderAuthCredentials.findUnique({
      where: { oid: d.managedCredentialsOid! },
      include: {
        provider: true,
        initialProviderAuthMethod: { include: { provider: true } },
        backings: {
          where: { tenantOid: d.tenantOid },
          include: { providerAuthCredentials: true, secrets: true }
        }
      }
    });
    let provider = owner?.provider ?? owner?.initialProviderAuthMethod.provider;
    let backing = owner?.backings[0];
    let secret = backing?.secrets.find(
      candidate =>
        candidate.id === d.credentialSecretId &&
        candidate.purpose === PROVISIONED_TENANT_APP_SECRET_PURPOSE &&
        candidate.secretVersion === d.credentialVersion &&
        candidate.status === 'active' &&
        candidate.validFrom <= d.now &&
        (candidate.validUntil === null || candidate.validUntil > d.now)
    );
    assertResolvedProvisionedCredentialAuthority({
      ...d,
      credentialSecretId: d.credentialSecretId!,
      resolved: {
        ownerExists: owner !== null,
        ownerActive: owner?.status === 'active',
        ownerIsTenantOwned: false,
        ownerRef: owner?.id ?? null,
        ownerTenantOid: null,
        managedCredentialsOid: owner?.oid ?? null,
        bindingTenantOid: backing?.tenantOid ?? null,
        vendor: provider?.identifier ?? null,
        secretId: secret?.id ?? null,
        secretPurpose: secret?.purpose ?? null,
        secretVersion: secret?.secretVersion ?? null,
        secretStatus: secret?.status ?? null,
        secretTenantOid: secret?.tenantOid ?? null,
        secretValidFrom: secret?.validFrom ?? null,
        secretValidUntil: secret?.validUntil ?? null,
        secretOwnerMatches:
          secret !== undefined &&
          backing !== undefined &&
          secret.providerAuthCredentialsOid === backing.providerAuthCredentialsOid &&
          secret.managedCredentialsOid === owner?.oid
      }
    });
    return;
  }

  let owner = await d.tx.providerAuthCredentials.findUnique({
    where: { id: d.credentialOwnerRef },
    include: { provider: true }
  });
  if (
    !owner ||
    owner.status !== 'active' ||
    owner.origin !== 'tenant_created' ||
    owner.tenantOid !== d.tenantOid ||
    normalizeVendor(owner.provider.identifier) !== normalizeVendor(d.vendor)
  ) {
    fail('byo_credential_authority_mismatch', 'BYO credential owner is invalid');
  }
  if (!byoCredentialSecretAuthorityResolver) {
    fail('byo_credential_authority_unavailable', 'BYO secret authority is unavailable');
  }
  await byoCredentialSecretAuthorityResolver.validate({
    provisionedTenantAppId: d.provisionedTenantAppId,
    hubTenantId: d.hubTenantId,
    callbackInstanceId: d.callbackInstanceId,
    provisionedRouteId: d.provisionedRouteId,
    routeGeneration: d.routeGeneration,
    vendor: d.vendor,
    credentialOwnerRef: d.credentialOwnerRef,
    credentialSecretId: d.credentialSecretId!,
    credentialSecretPurpose: PROVISIONED_TENANT_APP_SECRET_PURPOSE,
    credentialVersion: d.credentialVersion,
    hubReceiverId: d.hubReceiverId,
    hubReceiverGeneration: d.hubReceiverGeneration,
    hubReceiverTriggerId: d.hubReceiverTriggerId,
    triggerActionId: d.triggerActionId,
    triggerSpecHash: d.triggerSpecHash
  });
};

let loadBinding = async (tx: TransactionDB, id: string) => {
  let binding = await tx.provisionedTenantApp.findUnique({
    where: { id },
    include: bindingInclude
  });
  if (!binding) fail('provisioned_binding_not_found', 'Provisioned tenant app not found');
  return binding;
};

let tombstoneBindingInTransaction = async (
  tx: TransactionDB,
  current: Awaited<ReturnType<typeof loadBinding>>,
  now: Date,
  route: RouteProjectionSource = current.vendorAppRoute
) => {
  if (current.deletedAt) return null;
  let next = {
    ...current,
    vendorAppRoute: route,
    generation: current.generation + 1,
    status: 'tombstoned',
    retainedExternalOwnershipKey: current.externalOwnershipKey,
    externalOwnershipKey: null,
    deletedAt: now,
    updatedAt: now
  };
  let projection = buildProvisionedBindingProjection(next);
  let projectionDigest = digestProvisionedProjection(projection);
  let changed = await tx.provisionedTenantApp.updateMany({
    where: { oid: current.oid, generation: current.generation, deletedAt: null },
    data: {
      generation: next.generation,
      status: next.status,
      retainedExternalOwnershipKey: current.externalOwnershipKey,
      externalOwnershipKey: null,
      projectionDigest,
      deletedAt: now,
      updatedAt: now
    }
  });
  if (changed.count !== 1) fail('binding_generation_conflict', 'Tombstone CAS failed');
  let outbox = await createProjectionOutbox(tx, projection);
  return { projection, outboxId: outbox.row.id };
};

export let tombstoneProvisionedTenantAppsForCallbackInTransaction = async (
  tx: TransactionDB,
  callbackInstanceOid: bigint,
  now = new Date()
) => {
  let bindings = await tx.provisionedTenantApp.findMany({
    where: { callbackInstanceOid, deletedAt: null },
    include: bindingInclude,
    orderBy: { oid: 'asc' }
  });
  let results = [];
  for (let binding of bindings) {
    let result = await tombstoneBindingInTransaction(tx, binding, now);
    if (result) results.push(result);
  }
  return results;
};

class ProvisionedTenantAppServiceImpl {
  async createProvisionedVendorAppRoute(d: {
    input: {
      vendor: string;
      purpose: string;
      credentialOwnerRef: string;
      routeSecretId: string;
      routeSecretVersion: number;
      vendorVerificationSecretId: string;
      vendorVerificationVersion: number;
      expiresAt?: Date;
    };
  }) {
    let vendor = normalizeVendor(d.input.vendor);
    if (!vendor || d.input.purpose !== 'shared_provisioned_app') {
      fail('route_contract_invalid', 'A shared provisioned-app route contract is required');
    }
    if (
      !d.input.credentialOwnerRef ||
      d.input.routeSecretId === d.input.vendorVerificationSecretId
    ) {
      fail('route_secret_separation_invalid', 'Route and vendor secrets must be distinct');
    }
    assertSecretReference(d.input.routeSecretId, d.input.routeSecretVersion);
    assertSecretReference(
      d.input.vendorVerificationSecretId,
      d.input.vendorVerificationVersion
    );
    return await withTransaction(async tx => {
      let now = new Date();
      let ids = getId('provisionedVendorAppRoute');
      let source: RouteProjectionSource = {
        id: ids.id,
        routeIdentifier: randomBytes(24).toString('base64url'),
        vendor,
        purpose: d.input.purpose,
        credentialOwnerRef: d.input.credentialOwnerRef,
        generation: 1,
        routeSecretId: d.input.routeSecretId,
        routeSecretVersion: d.input.routeSecretVersion,
        vendorVerificationSecretId: d.input.vendorVerificationSecretId,
        vendorVerificationVersion: d.input.vendorVerificationVersion,
        status: 'active',
        expiresAt: d.input.expiresAt ?? null,
        deletedAt: null
      };
      let projection = buildProvisionedRouteProjection(source);
      let projectionDigest = digestProvisionedProjection(projection);
      let route = await tx.provisionedVendorAppRoute.create({
        data: { ...ids, ...source, projectionDigest, createdAt: now, updatedAt: now }
      });
      let outbox = await createProjectionOutbox(tx, projection);
      return { route, outboxId: outbox.row.id };
    });
  }

  async activateProvisionedVendorAppRoute(d: {
    provisionedRouteId: string;
    expectedGeneration: number;
    routeSecretId: string;
    routeSecretVersion: number;
    vendorVerificationSecretId: string;
    vendorVerificationVersion: number;
  }) {
    if (d.routeSecretId === d.vendorVerificationSecretId) {
      fail('route_secret_separation_invalid', 'Route and vendor secrets must be distinct');
    }
    assertSecretReference(d.routeSecretId, d.routeSecretVersion);
    assertSecretReference(d.vendorVerificationSecretId, d.vendorVerificationVersion);
    return await withTransaction(async tx => {
      let current = await tx.provisionedVendorAppRoute.findUnique({
        where: { id: d.provisionedRouteId }
      });
      if (!current || current.deletedAt || current.generation !== d.expectedGeneration) {
        fail('route_generation_conflict', 'Route generation is stale or unavailable');
      }
      let next = {
        ...current,
        generation: current.generation + 1,
        routeSecretId: d.routeSecretId,
        routeSecretVersion: d.routeSecretVersion,
        vendorVerificationSecretId: d.vendorVerificationSecretId,
        vendorVerificationVersion: d.vendorVerificationVersion,
        status: 'active',
        updatedAt: new Date()
      };
      let projection = buildProvisionedRouteProjection(next);
      let projectionDigest = digestProvisionedProjection(projection);
      let changed = await tx.provisionedVendorAppRoute.updateMany({
        where: { oid: current.oid, generation: current.generation, deletedAt: null },
        data: {
          generation: next.generation,
          routeSecretId: next.routeSecretId,
          routeSecretVersion: next.routeSecretVersion,
          vendorVerificationSecretId: next.vendorVerificationSecretId,
          vendorVerificationVersion: next.vendorVerificationVersion,
          status: next.status,
          projectionDigest,
          updatedAt: next.updatedAt
        }
      });
      if (changed.count !== 1) fail('route_generation_conflict', 'Route CAS failed');
      let outbox = await createProjectionOutbox(tx, projection);
      let dependents = await tx.provisionedTenantApp.findMany({
        where: { vendorAppRouteOid: current.oid, deletedAt: null },
        include: bindingInclude,
        orderBy: { oid: 'asc' }
      });
      let bindingOutboxIds: string[] = [];
      for (let binding of dependents) {
        if (binding.credentialOwnerType === 'managed') {
          let result = await tombstoneBindingInTransaction(tx, binding, next.updatedAt, next);
          if (result) bindingOutboxIds.push(result.outboxId);
          continue;
        }
        let bindingNext = {
          ...binding,
          vendorAppRoute: next,
          generation: binding.generation + 1,
          updatedAt: next.updatedAt
        };
        let bindingProjection = buildProvisionedBindingProjection(bindingNext);
        let bindingDigest = digestProvisionedProjection(bindingProjection);
        let bindingChanged = await tx.provisionedTenantApp.updateMany({
          where: { oid: binding.oid, generation: binding.generation, deletedAt: null },
          data: {
            generation: bindingNext.generation,
            projectionDigest: bindingDigest,
            updatedAt: next.updatedAt
          }
        });
        if (bindingChanged.count !== 1) {
          fail('binding_generation_conflict', 'Route cascade binding CAS failed');
        }
        let bindingOutbox = await createProjectionOutbox(tx, bindingProjection);
        bindingOutboxIds.push(bindingOutbox.row.id);
      }
      return {
        route: await tx.provisionedVendorAppRoute.findUniqueOrThrow({
          where: { oid: current.oid }
        }),
        outboxId: outbox.row.id,
        bindingOutboxIds
      };
    });
  }

  async createProvisionedTenantApp(d: {
    solution: Solution;
    input: {
      tenantId: string;
      callbackInstanceId: string;
      provisionedRouteId: string;
      expectedRouteGeneration: number;
      hubReceiverId: string;
      hubReceiverGeneration: number;
      hubReceiverTriggerId: string;
      triggerActionId: string;
      triggerSpecHash: string;
      credentialOwnerType: ProvisionedTenantAppCredentialOwnerType;
      managedProviderAuthCredentialsId?: string;
      credentialOwnerRef: string;
      credentialSecretValue?: string;
      expiresAt?: Date;
    };
  }) {
    if (
      !d.input.hubReceiverId ||
      !d.input.hubReceiverTriggerId ||
      !d.input.triggerActionId ||
      !d.input.triggerSpecHash ||
      !Number.isInteger(d.input.hubReceiverGeneration) ||
      d.input.hubReceiverGeneration <= 0
    ) {
      fail('hub_receiver_binding_invalid', 'Exact Hub receiver authority is required');
    }
    return await withTransaction(async tx => {
      let tenant = await tx.tenant.findUnique({ where: { id: d.input.tenantId } });
      let callbackInstance = await tx.callbackInstance.findUnique({
        where: { id: d.input.callbackInstanceId },
        include: { callback: true }
      });
      let route = await tx.provisionedVendorAppRoute.findUnique({
        where: { id: d.input.provisionedRouteId }
      });
      if (!tenant || !tenant.slateTenantId) {
        fail('tenant_authority_invalid', 'Tenant is not projected to Hub');
      }
      if (!callbackInstance || callbackInstance.callback.tenantOid !== tenant.oid) {
        fail('callback_tenant_mismatch', 'Callback instance does not belong to tenant');
      }
      if (
        !route ||
        route.deletedAt ||
        route.status !== 'active' ||
        route.generation !== d.input.expectedRouteGeneration ||
        route.purpose !== 'shared_provisioned_app' ||
        (route.expiresAt && route.expiresAt <= new Date())
      ) {
        fail('route_authority_invalid', 'Provisioned route is unavailable');
      }
      let managedOwner = d.input.managedProviderAuthCredentialsId
        ? await tx.managedProviderAuthCredentials.findFirst({
            where: {
              id: d.input.managedProviderAuthCredentialsId,
              solutionOid: d.solution.oid,
              status: 'active'
            },
            include: {
              provider: true,
              initialProviderAuthMethod: { include: { provider: true } },
              backings: {
                where: { tenantOid: tenant.oid },
                include: {
                  tenant: true,
                  managedCredentials: { select: { id: true } },
                  providerAuthCredentials: { select: { id: true, status: true } }
                }
              }
            }
          })
        : null;
      assertProvisionedCredentialOwnerShape({
        credentialOwnerType: d.input.credentialOwnerType,
        managedCredentialsOid: managedOwner?.oid
      });
      let managedBacking = managedOwner?.backings[0];
      let managedProvider =
        managedOwner?.provider ?? managedOwner?.initialProviderAuthMethod.provider;
      if (
        d.input.credentialOwnerType === 'managed' &&
        (!managedOwner ||
          !managedBacking ||
          managedBacking.providerAuthCredentials.status !== 'active' ||
          route.credentialOwnerRef !== managedOwner.id ||
          d.input.credentialOwnerRef !== managedOwner.id ||
          normalizeVendor(managedProvider!.identifier) !== normalizeVendor(route.vendor) ||
          !d.input.credentialSecretValue)
      ) {
        fail(
          'managed_credential_authority_mismatch',
          'Managed binding must inherit the current route verification authority'
        );
      }
      if (d.input.credentialOwnerType === 'byo') {
        let byoOwner = await tx.providerAuthCredentials.findFirst({
          where: {
            id: d.input.credentialOwnerRef,
            tenantOid: tenant.oid,
            solutionOid: d.solution.oid,
            origin: 'tenant_created',
            status: 'active'
          },
          include: { provider: true }
        });
        if (
          !byoOwner ||
          normalizeVendor(byoOwner.provider.identifier) !== normalizeVendor(route.vendor)
        ) {
          fail('byo_credential_authority_mismatch', 'BYO credential owner is invalid');
        }
      }
      let duplicate = await tx.provisionedTenantApp.findFirst({
        where: {
          tenantOid: tenant.oid,
          callbackInstanceOid: callbackInstance.oid,
          vendorAppRouteOid: route.oid,
          purpose: route.purpose,
          deletedAt: null
        }
      });
      if (duplicate) {
        fail('provisioned_binding_exists', 'Callback already owns a live app binding');
      }
      let now = new Date();
      let ids = getId('provisionedTenantApp');
      let generatedByoCredentialSecretId = getId('providerAuthCredentials').id;
      let credentialSecretId =
        d.input.credentialOwnerType === 'managed'
          ? route.vendorVerificationSecretId
          : generatedByoCredentialSecretId;
      let credentialVersion =
        d.input.credentialOwnerType === 'managed' ? route.vendorVerificationVersion : 1;
      let correlationId = randomUUID();
      let source: BindingProjectionSource = {
        id: ids.id,
        tenant,
        callbackInstance,
        vendorAppRoute: route,
        hubReceiverId: d.input.hubReceiverId,
        hubReceiverGeneration: d.input.hubReceiverGeneration,
        hubReceiverTriggerId: d.input.hubReceiverTriggerId,
        triggerActionId: d.input.triggerActionId,
        triggerSpecHash: d.input.triggerSpecHash,
        vendor: route.vendor,
        purpose: route.purpose,
        externalAppId: null,
        externalAccountId: null,
        externalInstallationId: null,
        externalOwnershipKey: null,
        retainedExternalOwnershipKey: null,
        ownerIdentity: null,
        credentialOwnerType: d.input.credentialOwnerType,
        credentialOwnerRef: d.input.credentialOwnerRef,
        credentialSecretId,
        credentialSecretPurpose: PROVISIONED_TENANT_APP_SECRET_PURPOSE,
        credentialVersion,
        generation: 1,
        status: 'pending',
        expiresAt: d.input.expiresAt ?? null,
        deletedAt: null
      };
      let projection = buildProvisionedBindingProjection(source);
      let projectionDigest = digestProvisionedProjection(projection);
      let binding = await tx.provisionedTenantApp.create({
        data: {
          ...ids,
          tenantOid: tenant.oid,
          callbackInstanceOid: callbackInstance.oid,
          vendorAppRouteOid: route.oid,
          hubReceiverId: source.hubReceiverId,
          hubReceiverGeneration: source.hubReceiverGeneration,
          hubReceiverTriggerId: source.hubReceiverTriggerId,
          triggerActionId: source.triggerActionId,
          triggerSpecHash: source.triggerSpecHash,
          vendor: source.vendor,
          purpose: source.purpose,
          credentialOwnerType: source.credentialOwnerType,
          managedCredentialsOid: managedOwner?.oid ?? null,
          credentialOwnerRef: source.credentialOwnerRef,
          credentialSecretId: source.credentialSecretId,
          credentialSecretPurpose: source.credentialSecretPurpose,
          credentialVersion: source.credentialVersion,
          generation: source.generation,
          status: source.status,
          projectionDigest,
          correlationId,
          expiresAt: source.expiresAt,
          createdAt: now,
          updatedAt: now
        },
        include: bindingInclude
      });
      let secret = null;
      if (managedOwner && managedBacking) {
        let result = await createOrRotateManagedVendorVerificationSecretInTransaction({
          tx,
          owner: managedOwner,
          backing: managedBacking,
          plaintext: d.input.credentialSecretValue!,
          expectedSecretId: route.vendorVerificationSecretId,
          expectedSecretVersion: route.vendorVerificationVersion,
          now
        });
        secret = {
          id: result.secret.id,
          status: result.secret.status,
          secretVersion: result.secret.secretVersion
        };
      }
      let outbox = await createProjectionOutbox(tx, projection, correlationId);
      return {
        binding,
        secret,
        auditCorrelationId: correlationId,
        secretIssuanceReceipt: null as null,
        outboxId: outbox.row.id
      };
    });
  }

  async createOrRotateProvisionedTenantCredentialSecret(d: {
    solution: Solution;
    provisionedTenantAppId: string;
    expectedGeneration: number;
    importedValue: string;
  }) {
    if (!d.importedValue) {
      fail('credential_secret_material_invalid', 'Provisioning secret material is required');
    }
    let snapshot = await db.provisionedTenantApp.findUnique({
      where: { id: d.provisionedTenantAppId },
      include: {
        managedCredentials: true,
        vendorAppRoute: true
      }
    });
    if (
      !snapshot ||
      snapshot.deletedAt ||
      snapshot.generation !== d.expectedGeneration ||
      snapshot.credentialSecretPurpose !== PROVISIONED_TENANT_APP_SECRET_PURPOSE ||
      !snapshot.credentialSecretId
    ) {
      fail('binding_generation_conflict', 'Provisioned credential binding is stale');
    }

    let remoteResult: Awaited<
      ReturnType<ProvisionedByoCredentialSecretAuthorityResolver['createOrRotate']>
    > | null = null;
    if (snapshot.credentialOwnerType === 'byo') {
      let owner = await db.providerAuthCredentials.findFirst({
        where: {
          id: snapshot.credentialOwnerRef,
          tenantOid: snapshot.tenantOid,
          solutionOid: d.solution.oid,
          origin: 'tenant_created',
          status: 'active'
        },
        include: { provider: true }
      });
      if (
        !owner ||
        normalizeVendor(owner.provider.identifier) !== normalizeVendor(snapshot.vendor)
      ) {
        fail('byo_credential_authority_mismatch', 'BYO credential owner is invalid');
      }
      if (!byoCredentialSecretAuthorityResolver) {
        fail('byo_credential_authority_unavailable', 'BYO secret authority is unavailable');
      }
      remoteResult = await byoCredentialSecretAuthorityResolver.createOrRotate({
        provisionedTenantAppId: snapshot.id,
        importedValue: d.importedValue
      });
      if (
        remoteResult.secret.id !== snapshot.credentialSecretId ||
        remoteResult.secret.secretVersion !== snapshot.credentialVersion ||
        remoteResult.secret.status !== 'active' ||
        remoteResult.secretIssuanceReceipt !== null
      ) {
        fail('byo_credential_authority_mismatch', 'Hub returned a mismatched secret write');
      }
    }

    return await withTransaction(async tx => {
      let current = await loadBinding(tx, d.provisionedTenantAppId);
      if (
        current.deletedAt ||
        current.generation !== d.expectedGeneration ||
        current.credentialSecretId !== snapshot.credentialSecretId ||
        current.credentialVersion !== snapshot.credentialVersion
      ) {
        fail('binding_generation_conflict', 'Provisioned credential write CAS failed');
      }
      let secret: { id: string; status: string; secretVersion: number };
      let auditCorrelationId = remoteResult?.auditCorrelationId ?? randomUUID();
      let idempotent = remoteResult?.idempotent ?? false;
      if (current.credentialOwnerType === 'managed') {
        let owner = await tx.managedProviderAuthCredentials.findFirst({
          where: {
            oid: current.managedCredentialsOid!,
            id: current.credentialOwnerRef,
            solutionOid: d.solution.oid,
            status: 'active'
          },
          include: {
            provider: true,
            initialProviderAuthMethod: { include: { provider: true } },
            backings: {
              where: { tenantOid: current.tenantOid },
              include: {
                tenant: true,
                managedCredentials: { select: { id: true } },
                providerAuthCredentials: { select: { id: true, status: true } }
              }
            }
          }
        });
        let provider = owner?.provider ?? owner?.initialProviderAuthMethod.provider;
        let backing = owner?.backings[0];
        if (
          !owner ||
          !backing ||
          backing.providerAuthCredentials.status !== 'active' ||
          normalizeVendor(provider!.identifier) !== normalizeVendor(current.vendor)
        ) {
          fail('managed_credential_authority_mismatch', 'Managed credential owner is invalid');
        }
        let result = await createOrRotateManagedVendorVerificationSecretInTransaction({
          tx,
          owner,
          backing,
          plaintext: d.importedValue,
          expectedSecretId: current.credentialSecretId!,
          expectedSecretVersion: current.credentialVersion
        });
        secret = result.secret;
        idempotent = result.idempotent;
      } else {
        secret = remoteResult!.secret;
      }

      let next = { ...current, generation: current.generation + 1, updatedAt: new Date() };
      let projection = buildProvisionedBindingProjection(next);
      let projectionDigest = digestProvisionedProjection(projection);
      let changed = await tx.provisionedTenantApp.updateMany({
        where: { oid: current.oid, generation: current.generation, deletedAt: null },
        data: {
          generation: next.generation,
          projectionDigest,
          correlationId: auditCorrelationId,
          updatedAt: next.updatedAt
        }
      });
      if (changed.count !== 1) {
        fail('binding_generation_conflict', 'Provisioned credential write CAS failed');
      }
      let outbox = await createProjectionOutbox(tx, projection, auditCorrelationId);
      return {
        binding: await loadBinding(tx, current.id),
        secret: {
          id: secret.id,
          status: secret.status,
          secretVersion: secret.secretVersion
        },
        auditCorrelationId,
        idempotent,
        outboxId: outbox.row.id,
        secretIssuanceReceipt: null as null
      };
    });
  }

  async revokeProvisionedTenantCredentialSecret(d: {
    solution: Solution;
    provisionedTenantAppId: string;
    expectedGeneration: number;
  }) {
    let snapshot = await db.provisionedTenantApp.findUnique({
      where: { id: d.provisionedTenantAppId },
      include: { managedCredentials: true }
    });
    if (
      !snapshot ||
      snapshot.deletedAt ||
      snapshot.generation !== d.expectedGeneration ||
      !snapshot.credentialSecretId ||
      snapshot.credentialSecretPurpose !== PROVISIONED_TENANT_APP_SECRET_PURPOSE
    ) {
      fail('binding_generation_conflict', 'Provisioned credential binding is stale');
    }
    let remoteResult =
      snapshot.credentialOwnerType === 'byo'
        ? await (async () => {
            let owner = await db.providerAuthCredentials.findFirst({
              where: {
                id: snapshot.credentialOwnerRef,
                tenantOid: snapshot.tenantOid,
                solutionOid: d.solution.oid,
                origin: 'tenant_created'
              }
            });
            if (!owner || !byoCredentialSecretAuthorityResolver) {
              fail('byo_credential_authority_mismatch', 'BYO credential owner is invalid');
            }
            return await byoCredentialSecretAuthorityResolver.revoke({
              provisionedTenantAppId: snapshot.id
            });
          })()
        : null;
    return await withTransaction(async tx => {
      let current = await loadBinding(tx, d.provisionedTenantAppId);
      if (current.generation !== d.expectedGeneration || current.deletedAt) {
        fail('binding_generation_conflict', 'Provisioned credential revoke CAS failed');
      }
      let result: {
        secret: { id: string; status: string; secretVersion: number };
        auditCorrelationId?: string | null;
        idempotent: boolean;
      } | null = remoteResult;
      if (current.credentialOwnerType === 'managed') {
        let backing = await tx.managedProviderAuthCredentialsBacking.findFirst({
          where: {
            managedCredentialsOid: current.managedCredentialsOid!,
            tenantOid: current.tenantOid,
            managedCredentials: { solutionOid: d.solution.oid }
          }
        });
        if (!backing) {
          fail('managed_credential_authority_mismatch', 'Managed credential owner is invalid');
        }
        let managedResult = await revokeManagedVendorVerificationSecretInTransaction({
          tx,
          backingOid: backing.oid,
          tenantOid: backing.tenantOid,
          managedCredentialsOid: backing.managedCredentialsOid,
          providerAuthCredentialsOid: backing.providerAuthCredentialsOid,
          secretId: current.credentialSecretId!,
          secretVersion: current.credentialVersion
        });
        result = {
          secret: managedResult.secret,
          auditCorrelationId: null,
          idempotent: managedResult.idempotent
        };
      }
      let now = new Date();
      let next = {
        ...current,
        generation: current.generation + 1,
        status: 'credential_revoked',
        updatedAt: now
      };
      let projection = buildProvisionedBindingProjection(next);
      let projectionDigest = digestProvisionedProjection(projection);
      let auditCorrelationId = remoteResult?.auditCorrelationId ?? randomUUID();
      let changed = await tx.provisionedTenantApp.updateMany({
        where: { oid: current.oid, generation: current.generation, deletedAt: null },
        data: {
          generation: next.generation,
          status: next.status,
          projectionDigest,
          correlationId: auditCorrelationId,
          updatedAt: now
        }
      });
      if (changed.count !== 1) {
        fail('binding_generation_conflict', 'Provisioned credential revoke CAS failed');
      }
      let outbox = await createProjectionOutbox(tx, projection, auditCorrelationId);
      return {
        binding: await loadBinding(tx, current.id),
        secret: result!.secret,
        auditCorrelationId,
        idempotent: result!.idempotent,
        outboxId: outbox.row.id,
        secretIssuanceReceipt: null as null
      };
    });
  }

  private async activateVerified(d: {
    provisionedTenantAppId: string;
    expectedGeneration: number;
    ownership: VerifiedProvisionedExternalOwnership;
    githubInstallationCompleted?: boolean;
  }) {
    return await withTransaction(async tx => {
      let current = await loadBinding(tx, d.provisionedTenantAppId);
      if (
        current.deletedAt ||
        current.generation !== d.expectedGeneration ||
        current.status !==
          (d.githubInstallationCompleted ? 'installation_pending' : 'pending') ||
        current.vendorAppRoute.status !== 'active' ||
        current.vendorAppRoute.deletedAt ||
        (current.vendorAppRoute.expiresAt && current.vendorAppRoute.expiresAt <= new Date())
      ) {
        fail('binding_generation_conflict', 'Binding or route authority is stale');
      }
      for (let field of [
        'externalAppId',
        'externalAccountId',
        'externalInstallationId',
        'ownerIdentity'
      ] as const) {
        if (current[field] !== null && current[field] !== (d.ownership[field] ?? null)) {
          fail(
            'external_ownership_immutable',
            'Assigned external ownership requires tombstone plus a new binding ID'
          );
        }
      }
      let now = new Date();
      await resolveProvisionedCredentialOwner({
        tx,
        tenantOid: current.tenantOid,
        vendor: current.vendor,
        credentialOwnerType: current.credentialOwnerType,
        managedCredentialsOid: current.managedCredentialsOid,
        credentialOwnerRef: current.credentialOwnerRef,
        credentialSecretId: current.credentialSecretId,
        credentialSecretPurpose: current.credentialSecretPurpose,
        credentialVersion: current.credentialVersion,
        provisionedTenantAppId: current.id,
        hubTenantId: current.tenant.slateTenantId!,
        callbackInstanceId: current.callbackInstance.id,
        provisionedRouteId: current.vendorAppRoute.id,
        routeGeneration: current.vendorAppRoute.generation,
        hubReceiverId: current.hubReceiverId,
        hubReceiverGeneration: current.hubReceiverGeneration,
        hubReceiverTriggerId: current.hubReceiverTriggerId,
        triggerActionId: current.triggerActionId,
        triggerSpecHash: current.triggerSpecHash,
        now
      });
      let externalOwnershipKey = buildProvisionedExternalOwnershipKey({
        vendor: current.vendor,
        ...d.ownership
      });
      let next = {
        ...current,
        ...d.ownership,
        externalOwnershipKey,
        retainedExternalOwnershipKey: null,
        generation: current.generation + 1,
        status: 'active',
        githubInstallationCompletedAt: d.githubInstallationCompleted ? now : undefined,
        updatedAt: now
      };
      let projection = buildProvisionedBindingProjection(next);
      let projectionDigest = digestProvisionedProjection(projection);
      let changed = await tx.provisionedTenantApp.updateMany({
        where: { oid: current.oid, generation: current.generation, deletedAt: null },
        data: {
          externalAppId: d.ownership.externalAppId,
          externalAccountId: d.ownership.externalAccountId,
          externalInstallationId: d.ownership.externalInstallationId,
          externalOwnershipKey,
          retainedExternalOwnershipKey: null,
          ownerIdentity: d.ownership.ownerIdentity,
          generation: next.generation,
          status: 'active',
          projectionDigest,
          githubInstallationCompletedAt: next.githubInstallationCompletedAt,
          updatedAt: now
        }
      });
      if (changed.count !== 1) {
        fail('binding_generation_conflict', 'Binding activation CAS failed');
      }
      let outbox = await createProjectionOutbox(tx, projection);
      return {
        binding: await loadBinding(tx, current.id),
        outboxId: outbox.row.id
      };
    });
  }

  async activateProvisionedTenantApp(d: {
    provisionedTenantAppId: string;
    expectedGeneration: number;
    ownershipProof: Record<string, unknown>;
  }) {
    let current = await db.provisionedTenantApp.findUnique({
      where: { id: d.provisionedTenantAppId },
      include: { vendorAppRoute: true }
    });
    if (!current || current.generation !== d.expectedGeneration) {
      fail('binding_generation_conflict', 'Binding generation is stale');
    }
    if (!externalOwnershipVerifier) {
      fail('external_ownership_verifier_unavailable', 'Ownership verifier is unavailable');
    }
    let ownership = await externalOwnershipVerifier.verify({
      vendor: current.vendor,
      proof: d.ownershipProof,
      expectedAppId: current.externalAppId
    });
    return await this.activateVerified({ ...d, ownership });
  }

  async beginGithubManifest(d: {
    provisionedTenantAppId: string;
    expectedGeneration: number;
  }) {
    if (!githubManifestProvisioner) {
      fail(
        'github_manifest_capability_unavailable',
        'GitHub manifest redirect is unavailable'
      );
    }
    let provisioner = githubManifestProvisioner;
    let state = randomBytes(32).toString('base64url');
    let stateHash = hashGithubManifestState(state);
    let expiresAt = new Date(Date.now() + GITHUB_MANIFEST_STATE_TTL_MS);
    let result = await withTransaction(async tx => {
      let current = await loadBinding(tx, d.provisionedTenantAppId);
      if (
        normalizeVendor(current.vendor) !== 'github' ||
        current.generation !== d.expectedGeneration ||
        !['pending', 'manifest_pending'].includes(current.status) ||
        current.deletedAt
      ) {
        fail('github_manifest_state_invalid', 'GitHub manifest setup is unavailable');
      }
      let next = {
        ...current,
        generation: current.generation + 1,
        status: 'manifest_pending',
        githubManifestStateHash: stateHash,
        githubManifestStateExpiresAt: expiresAt,
        updatedAt: new Date()
      };
      let projection = buildProvisionedBindingProjection(next);
      let projectionDigest = digestProvisionedProjection(projection);
      let changed = await tx.provisionedTenantApp.updateMany({
        where: { oid: current.oid, generation: current.generation, deletedAt: null },
        data: {
          generation: next.generation,
          status: next.status,
          githubManifestStateHash: stateHash,
          githubManifestStateExpiresAt: expiresAt,
          projectionDigest,
          updatedAt: next.updatedAt
        }
      });
      if (changed.count !== 1) fail('binding_generation_conflict', 'Manifest CAS failed');
      let outbox = await createProjectionOutbox(tx, projection);
      return { generation: next.generation, outboxId: outbox.row.id };
    });
    let redirectUrl = provisioner.getManifestRedirectUrl({
      state,
      provisionedTenantAppId: d.provisionedTenantAppId
    });
    return { state, redirectUrl, expiresAt, ...result };
  }

  async completeGithubManifest(d: {
    provisionedTenantAppId: string;
    expectedGeneration: number;
    state: string;
    code: string;
  }) {
    if (!githubManifestProvisioner) {
      fail(
        'github_manifest_capability_unavailable',
        'GitHub manifest exchange is unavailable'
      );
    }
    let current = await db.provisionedTenantApp.findUnique({
      where: { id: d.provisionedTenantAppId }
    });
    if (
      !current ||
      current.generation !== d.expectedGeneration ||
      current.status !== 'manifest_pending' ||
      normalizeVendor(current.vendor) !== 'github'
    ) {
      fail('github_manifest_state_invalid', 'GitHub manifest state is invalid or expired');
    }
    assertGithubManifestState({
      presentedState: d.state,
      storedStateHash: current.githubManifestStateHash,
      expiresAt: current.githubManifestStateExpiresAt
    });
    let exchanged = await githubManifestProvisioner.exchangeManifestCode({
      code: d.code,
      state: d.state,
      provisionedTenantAppId: d.provisionedTenantAppId
    });
    return await withTransaction(async tx => {
      let locked = await loadBinding(tx, d.provisionedTenantAppId);
      if (
        locked.generation !== d.expectedGeneration ||
        locked.status !== 'manifest_pending' ||
        normalizeVendor(locked.vendor) !== 'github' ||
        locked.githubManifestStateHash !== current.githubManifestStateHash ||
        locked.githubManifestStateExpiresAt?.getTime() !==
          current.githubManifestStateExpiresAt?.getTime()
      ) {
        fail('github_manifest_state_invalid', 'GitHub manifest state was already consumed');
      }
      let now = new Date();
      assertGithubManifestState({
        presentedState: d.state,
        storedStateHash: locked.githubManifestStateHash,
        expiresAt: locked.githubManifestStateExpiresAt,
        now
      });
      let next = {
        ...locked,
        externalAppId: exchanged.externalAppId,
        ownerIdentity: exchanged.ownerIdentity,
        generation: locked.generation + 1,
        status: 'installation_pending',
        githubManifestStateHash: null,
        githubManifestStateExpiresAt: null,
        githubManifestCompletedAt: now,
        updatedAt: now
      };
      let projection = buildProvisionedBindingProjection(next);
      let projectionDigest = digestProvisionedProjection(projection);
      let changed = await tx.provisionedTenantApp.updateMany({
        where: {
          oid: locked.oid,
          generation: locked.generation,
          githubManifestStateHash: locked.githubManifestStateHash,
          deletedAt: null
        },
        data: {
          externalAppId: exchanged.externalAppId,
          ownerIdentity: exchanged.ownerIdentity,
          generation: next.generation,
          status: next.status,
          githubManifestStateHash: null,
          githubManifestStateExpiresAt: null,
          githubManifestCompletedAt: now,
          projectionDigest,
          updatedAt: now
        }
      });
      if (changed.count !== 1) {
        fail('github_manifest_state_invalid', 'GitHub manifest state was already consumed');
      }
      let outbox = await createProjectionOutbox(tx, projection);
      return { binding: await loadBinding(tx, locked.id), outboxId: outbox.row.id };
    });
  }

  async completeGithubInstallation(d: {
    provisionedTenantAppId: string;
    expectedGeneration: number;
    installationCode: string;
  }) {
    if (!githubManifestProvisioner) {
      fail('github_manifest_capability_unavailable', 'GitHub installation is unavailable');
    }
    let current = await db.provisionedTenantApp.findUnique({
      where: { id: d.provisionedTenantAppId }
    });
    if (
      !current ||
      current.generation !== d.expectedGeneration ||
      current.status !== 'installation_pending' ||
      !current.externalAppId
    ) {
      fail('github_installation_state_invalid', 'GitHub installation state is invalid');
    }
    let ownership = await githubManifestProvisioner.resolveInstallation({
      installationCode: d.installationCode,
      expectedAppId: current.externalAppId
    });
    if (ownership.externalAppId !== current.externalAppId) {
      fail('github_installation_app_mismatch', 'Installation belongs to another app');
    }
    return await this.activateVerified({
      provisionedTenantAppId: d.provisionedTenantAppId,
      expectedGeneration: d.expectedGeneration,
      ownership,
      githubInstallationCompleted: true
    });
  }

  async rebindProvisionedTenantApp(d: {
    provisionedTenantAppId: string;
    expectedGeneration: number;
    expectedRouteGeneration: number;
    input: {
      callbackInstanceId: string;
      hubReceiverId: string;
      hubReceiverGeneration: number;
      hubReceiverTriggerId: string;
      triggerActionId: string;
      triggerSpecHash: string;
    };
  }) {
    return await withTransaction(async tx => {
      let current = await loadBinding(tx, d.provisionedTenantAppId);
      if (
        current.generation !== d.expectedGeneration ||
        current.status !== 'active' ||
        current.deletedAt ||
        !current.externalOwnershipKey ||
        d.input.hubReceiverGeneration !== current.hubReceiverGeneration + 1
      ) {
        fail(
          'binding_reprovision_required',
          'A stale or non-incrementing receiver generation requires reprovisioning'
        );
      }
      let route = current.vendorAppRoute;
      if (
        route.generation !== d.expectedRouteGeneration ||
        route.status !== 'active' ||
        route.deletedAt ||
        route.purpose !== 'shared_provisioned_app' ||
        route.purpose !== current.purpose ||
        normalizeVendor(route.vendor) !== normalizeVendor(current.vendor) ||
        (route.expiresAt && route.expiresAt <= new Date())
      ) {
        fail('route_authority_invalid', 'Replacement route authority is stale');
      }
      if (
        current.credentialOwnerType === 'managed' &&
        route.credentialOwnerRef !== current.credentialOwnerRef
      ) {
        fail(
          'managed_credential_authority_mismatch',
          'Managed replacement must inherit the current route verification authority'
        );
      }
      assertSecretReference(route.vendorVerificationSecretId, route.vendorVerificationVersion);
      let callbackInstance = await tx.callbackInstance.findUnique({
        where: { id: d.input.callbackInstanceId },
        include: { callback: true }
      });
      if (!callbackInstance || callbackInstance.callback.tenantOid !== current.tenantOid) {
        fail('callback_tenant_mismatch', 'Replacement callback belongs to another tenant');
      }
      let now = new Date();
      let routeCas = await tx.provisionedVendorAppRoute.updateMany({
        where: {
          oid: route.oid,
          generation: d.expectedRouteGeneration,
          status: 'active',
          deletedAt: null
        },
        // Take a write lock without changing the route authority. A concurrent rotation
        // must win or lose before the replacement can be committed.
        data: { updatedAt: route.updatedAt }
      });
      if (routeCas.count !== 1) {
        fail('route_authority_invalid', 'Replacement route authority changed');
      }
      let replacementExternalOwnershipKey = current.externalOwnershipKey;
      let tombstoneSource = {
        ...current,
        generation: current.generation + 1,
        status: 'tombstoned',
        retainedExternalOwnershipKey: current.externalOwnershipKey,
        externalOwnershipKey: null,
        deletedAt: now,
        updatedAt: now
      };
      let tombstoneProjection = buildProvisionedBindingProjection(tombstoneSource);
      let tombstoneDigest = digestProvisionedProjection(tombstoneProjection);
      let tombstoned = await tx.provisionedTenantApp.updateMany({
        where: { oid: current.oid, generation: current.generation, deletedAt: null },
        data: {
          generation: tombstoneSource.generation,
          status: tombstoneSource.status,
          retainedExternalOwnershipKey: replacementExternalOwnershipKey,
          externalOwnershipKey: null,
          projectionDigest: tombstoneDigest,
          deletedAt: now,
          updatedAt: now
        }
      });
      if (tombstoned.count !== 1) {
        fail('binding_generation_conflict', 'Rebind tombstone CAS failed');
      }
      let tombstoneOutbox = await createProjectionOutbox(tx, tombstoneProjection);

      let ids = getId('provisionedTenantApp');
      let managedReplacement = current.credentialOwnerType === 'managed';
      let replacementCredentialSecretId = managedReplacement
        ? route.vendorVerificationSecretId
        : getId('providerAuthCredentials').id;
      let replacementCredentialVersion = managedReplacement
        ? route.vendorVerificationVersion
        : current.credentialVersion + 1;
      let replacementSource: BindingProjectionSource = {
        ...current,
        ...d.input,
        id: ids.id,
        callbackInstance,
        vendorAppRoute: route,
        credentialSecretId: replacementCredentialSecretId,
        credentialVersion: replacementCredentialVersion,
        generation: tombstoneSource.generation + 1,
        status: managedReplacement ? 'active' : 'pending',
        externalOwnershipKey: replacementExternalOwnershipKey,
        retainedExternalOwnershipKey: null,
        deletedAt: null
      };
      if (managedReplacement) {
        await resolveProvisionedCredentialOwner({
          tx,
          tenantOid: current.tenantOid,
          vendor: current.vendor,
          credentialOwnerType: current.credentialOwnerType,
          managedCredentialsOid: current.managedCredentialsOid,
          credentialOwnerRef: current.credentialOwnerRef,
          credentialSecretId: replacementCredentialSecretId,
          credentialSecretPurpose: current.credentialSecretPurpose,
          credentialVersion: replacementCredentialVersion,
          provisionedTenantAppId: ids.id,
          hubTenantId: current.tenant.slateTenantId!,
          callbackInstanceId: callbackInstance.id,
          provisionedRouteId: route.id,
          routeGeneration: route.generation,
          hubReceiverId: d.input.hubReceiverId,
          hubReceiverGeneration: d.input.hubReceiverGeneration,
          hubReceiverTriggerId: d.input.hubReceiverTriggerId,
          triggerActionId: d.input.triggerActionId,
          triggerSpecHash: d.input.triggerSpecHash,
          now
        });
      }
      let replacementProjection = buildProvisionedBindingProjection(replacementSource);
      let replacementDigest = digestProvisionedProjection(replacementProjection);
      let replacement = await tx.provisionedTenantApp.create({
        data: {
          ...ids,
          tenantOid: current.tenantOid,
          callbackInstanceOid: callbackInstance.oid,
          vendorAppRouteOid: current.vendorAppRouteOid,
          hubReceiverId: d.input.hubReceiverId,
          hubReceiverGeneration: d.input.hubReceiverGeneration,
          hubReceiverTriggerId: d.input.hubReceiverTriggerId,
          triggerActionId: d.input.triggerActionId,
          triggerSpecHash: d.input.triggerSpecHash,
          vendor: current.vendor,
          purpose: current.purpose,
          externalAppId: current.externalAppId,
          externalAccountId: current.externalAccountId,
          externalInstallationId: current.externalInstallationId,
          externalOwnershipKey: replacementExternalOwnershipKey,
          ownerIdentity: current.ownerIdentity,
          credentialOwnerType: current.credentialOwnerType,
          managedCredentialsOid: current.managedCredentialsOid,
          credentialOwnerRef: current.credentialOwnerRef,
          credentialSecretId: replacementCredentialSecretId,
          credentialSecretPurpose: current.credentialSecretPurpose,
          credentialVersion: replacementCredentialVersion,
          generation: replacementSource.generation,
          status: replacementSource.status,
          projectionDigest: replacementDigest,
          correlationId: current.correlationId,
          expiresAt: current.expiresAt,
          githubManifestCompletedAt: current.githubManifestCompletedAt,
          githubInstallationCompletedAt: current.githubInstallationCompletedAt,
          createdAt: now,
          updatedAt: now
        },
        include: bindingInclude
      });
      let replacementOutbox = await createProjectionOutbox(tx, replacementProjection);
      return {
        binding: replacement,
        tombstoneOutboxId: tombstoneOutbox.row.id,
        outboxId: replacementOutbox.row.id
      };
    });
  }

  async tombstoneProvisionedTenantApp(d: {
    provisionedTenantAppId: string;
    expectedGeneration: number;
  }) {
    return await withTransaction(async tx => {
      let current = await loadBinding(tx, d.provisionedTenantAppId);
      if (current.generation !== d.expectedGeneration || current.deletedAt) {
        fail('binding_generation_conflict', 'Binding generation is stale');
      }
      let result = await tombstoneBindingInTransaction(tx, current, new Date());
      return {
        binding: await loadBinding(tx, current.id),
        outboxId: result!.outboxId
      };
    });
  }

  async tombstoneProvisionedVendorAppRoute(d: {
    provisionedRouteId: string;
    expectedGeneration: number;
  }) {
    return await withTransaction(async tx => {
      let current = await tx.provisionedVendorAppRoute.findUnique({
        where: { id: d.provisionedRouteId }
      });
      if (!current || current.generation !== d.expectedGeneration || current.deletedAt) {
        fail('route_generation_conflict', 'Route generation is stale');
      }
      let now = new Date();
      let next = {
        ...current,
        generation: current.generation + 1,
        status: 'tombstoned',
        deletedAt: now,
        updatedAt: now
      };
      let projection = buildProvisionedRouteProjection(next);
      let projectionDigest = digestProvisionedProjection(projection);
      let changed = await tx.provisionedVendorAppRoute.updateMany({
        where: { oid: current.oid, generation: current.generation, deletedAt: null },
        data: {
          generation: next.generation,
          status: next.status,
          projectionDigest,
          deletedAt: now,
          updatedAt: now
        }
      });
      if (changed.count !== 1) fail('route_generation_conflict', 'Tombstone CAS failed');
      let outbox = await createProjectionOutbox(tx, projection);
      let dependents = await tx.provisionedTenantApp.findMany({
        where: { vendorAppRouteOid: current.oid, deletedAt: null },
        include: bindingInclude,
        orderBy: { oid: 'asc' }
      });
      let bindingOutboxIds: string[] = [];
      for (let binding of dependents) {
        let result = await tombstoneBindingInTransaction(tx, binding, now, next);
        if (result) bindingOutboxIds.push(result.outboxId);
      }
      return {
        route: await tx.provisionedVendorAppRoute.findUniqueOrThrow({
          where: { oid: current.oid }
        }),
        outboxId: outbox.row.id,
        bindingOutboxIds
      };
    });
  }

  async getProvisionedTenantApp(d: { provisionedTenantAppId: string }) {
    let binding = await db.provisionedTenantApp.findUnique({
      where: { id: d.provisionedTenantAppId },
      include: bindingInclude
    });
    if (!binding) fail('provisioned_binding_not_found', 'Provisioned tenant app not found');
    return binding;
  }
}

export let provisionedTenantAppService = Service.create(
  'provisionedTenantAppService',
  () => new ProvisionedTenantAppServiceImpl()
).build();
