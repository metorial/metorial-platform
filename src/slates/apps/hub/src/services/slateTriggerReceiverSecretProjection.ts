import { createHash } from 'node:crypto';
import { computeWebhookActionSpecHashV1 } from '@slates/proto';
import { SlateTriggerReceiverTriggerSource, type Prisma } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { configureSlateProvisionedRouteAuthorityResolver } from './slateTriggerProvisionedRouteAuthority';
import { isRoutableWebhookReceiverTrigger } from './slateTriggerReceiverShared';

export let HUB_PROVISIONED_APP_TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export let HUB_PROVISIONED_TENANT_APP_SECRET_PURPOSE = 'vendor_verification' as const;

export class SlateProvisionedProjectionError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'SlateProvisionedProjectionError';
  }
}

function fail(code: string, message: string): never {
  throw new SlateProvisionedProjectionError(code, message);
}

let currentActionSpecHash = (spec: Record<string, any>) => {
  try {
    return computeWebhookActionSpecHashV1(spec as never);
  } catch {
    fail('binding_projection_stale', 'Current action specification is invalid');
  }
};

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

export let canonicalSlateProvisionedProjection = (value: unknown) =>
  JSON.stringify(canonicalValue(value));
export let digestSlateProvisionedProjection = (value: unknown) =>
  `sha256:${createHash('sha256')
    .update(canonicalSlateProvisionedProjection(value))
    .digest('hex')}`;

let lengthPrefix = (value: string) => `${Buffer.byteLength(value, 'utf8')}:${value}`;
export let buildSlateProvisionedExternalOwnershipKey = (d: {
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
  if (!identities.length) fail('external_identity_missing', 'External identity is missing');
  let material = [
    'provisioned-external-owner/v1',
    d.vendor.trim().toLowerCase(),
    ...identities.flatMap(([kind, value]) => [kind, value])
  ]
    .map(lengthPrefix)
    .join('|');
  return `peo1:${createHash('sha256').update(material).digest('hex')}`;
};

export type SlateProvisionedRouteProjectionV1 = {
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

export type SlateProvisionedBindingProjectionV1 = {
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
  credentialOwnerType: 'managed' | 'byo';
  credentialOwnerRef: string;
  credentialSecretId: string | null;
  credentialSecretPurpose: typeof HUB_PROVISIONED_TENANT_APP_SECRET_PURPOSE;
  credentialVersion: number;
  generation: number;
  status: string;
  tombstone: boolean;
  tombstoneRetainUntil: string | null;
  expiresAt: string | null;
};

export type SlateProvisionedProjectionEnvelope<
  Projection extends SlateProvisionedRouteProjectionV1 | SlateProvisionedBindingProjectionV1
> = {
  projection: Projection;
  projectionDigest: string;
  correlationId: string;
  idempotencyKey: string;
};

let parseDate = (value: string | null, field: string) => {
  if (value === null) return null;
  let parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) fail('projection_shape_invalid', `${field} invalid`);
  return parsed;
};

let validateEnvelope = <
  Projection extends SlateProvisionedRouteProjectionV1 | SlateProvisionedBindingProjectionV1
>(
  envelope: SlateProvisionedProjectionEnvelope<Projection>
) => {
  let projection = envelope.projection;
  let digest = digestSlateProvisionedProjection(projection);
  let entityId =
    projection.entityKind === 'route'
      ? projection.provisionedRouteId
      : projection.provisionedTenantAppId;
  let expectedIdempotencyKey = `provisioned-projection/v1:${projection.entityKind}:${entityId}:${projection.generation}:${digest}`;
  if (
    projection.version !== 1 ||
    !Number.isInteger(projection.generation) ||
    projection.generation <= 0 ||
    digest !== envelope.projectionDigest ||
    envelope.idempotencyKey !== expectedIdempotencyKey ||
    !envelope.correlationId
  ) {
    fail('projection_envelope_invalid', 'Projection envelope digest or identity is invalid');
  }
  let tombstoneRetainUntil = parseDate(
    projection.tombstoneRetainUntil,
    'tombstoneRetainUntil'
  );
  if (projection.tombstone && !tombstoneRetainUntil) {
    fail('projection_tombstone_invalid', 'Tombstone retention is required');
  }
  if (!projection.tombstone && tombstoneRetainUntil) {
    fail('projection_tombstone_invalid', 'Live projection cannot carry retention');
  }
  return {
    digest,
    expiresAt: parseDate(projection.expiresAt, 'expiresAt'),
    tombstoneRetainUntil
  };
};

let validateRouteSecrets = async (
  tx: Prisma.TransactionClient,
  projection: SlateProvisionedRouteProjectionV1,
  now: Date,
  allowMissing: boolean
) => {
  let rows = await tx.slateProvisionedAppRouteSecret.findMany({
    where: {
      provisionedRouteId: projection.provisionedRouteId,
      routeGeneration: projection.generation,
      id: {
        in: [projection.routeSecretId, projection.vendorVerificationSecretId]
      }
    }
  });
  if (rows.length === 0 && allowMissing) return;
  let pathSecret = rows.find(
    row =>
      row.id === projection.routeSecretId &&
      row.purpose === 'app_route_path' &&
      row.secretVersion === projection.routeSecretVersion
  );
  let vendorSecret = rows.find(
    row =>
      row.id === projection.vendorVerificationSecretId &&
      row.purpose === 'vendor_verification' &&
      row.secretVersion === projection.vendorVerificationVersion
  );
  let bindingValid = (row: (typeof rows)[number] | undefined) =>
    row &&
    row.vendor === projection.vendor &&
    row.credentialOwnerRef === projection.credentialOwnerRef;
  if (!bindingValid(pathSecret) || !bindingValid(vendorSecret)) {
    fail(
      'route_secret_binding_mismatch',
      'Route secret purpose, owner, generation, or version is invalid'
    );
  }
  if (!projection.tombstone) {
    let currentlyUsable = (row: (typeof rows)[number]) =>
      (row.status === 'active' || row.status === 'retiring') &&
      row.validFrom <= now &&
      (row.status === 'active' || (row.validUntil !== null && row.validUntil > now));
    if (!currentlyUsable(pathSecret!) || !currentlyUsable(vendorSecret!)) {
      fail('route_secret_unavailable', 'Route secret generation is not usable');
    }
  }
};

let validateRouteShape = (projection: SlateProvisionedRouteProjectionV1) => {
  if (
    projection.entityKind !== 'route' ||
    !projection.provisionedRouteId ||
    !projection.routeIdentifier ||
    !projection.vendor ||
    projection.purpose !== 'shared_provisioned_app' ||
    !projection.credentialOwnerRef ||
    !projection.routeSecretId ||
    !projection.vendorVerificationSecretId ||
    projection.routeSecretId === projection.vendorVerificationSecretId ||
    !Number.isInteger(projection.routeSecretVersion) ||
    projection.routeSecretVersion <= 0 ||
    !Number.isInteger(projection.vendorVerificationVersion) ||
    projection.vendorVerificationVersion <= 0 ||
    !['pending', 'active', 'tombstoned'].includes(projection.status) ||
    projection.tombstone !== (projection.status === 'tombstoned')
  ) {
    fail('route_projection_invalid', 'Route projection shape is invalid');
  }
};

export let projectSlateProvisionedAppRoute = async (
  envelope: SlateProvisionedProjectionEnvelope<SlateProvisionedRouteProjectionV1>,
  now = new Date()
) => {
  validateRouteShape(envelope.projection);
  let parsed = validateEnvelope(envelope);
  return await db.$transaction(
    async tx => {
      let projection = envelope.projection;
      let existing = await tx.slateProvisionedAppRouteProjection.findUnique({
        where: { provisionedRouteId: projection.provisionedRouteId }
      });
      let selectorOwner = await tx.slateProvisionedAppRouteProjection.findUnique({
        where: { routeIdentifier: projection.routeIdentifier }
      });
      if (
        selectorOwner &&
        selectorOwner.provisionedRouteId !== projection.provisionedRouteId
      ) {
        fail('route_identifier_conflict', 'Route selector belongs to another route');
      }
      if (existing) {
        if (projection.generation === existing.generation) {
          if (parsed.digest !== existing.projectionDigest) {
            fail('projection_digest_conflict', 'Same-generation route digest conflict');
          }
          return {
            generation: existing.generation,
            projectionDigest: existing.projectionDigest,
            idempotent: true
          };
        }
        if (projection.generation !== existing.generation + 1) {
          fail('projection_generation_rejected', 'Route projection is stale or out of order');
        }
        if (existing.tombstonedAt && !projection.tombstone) {
          fail('projection_resurrection_rejected', 'Tombstoned route cannot be reused');
        }
        if (
          existing.routeIdentifier !== projection.routeIdentifier ||
          existing.vendor !== projection.vendor ||
          existing.purpose !== projection.purpose ||
          existing.credentialOwnerRef !== projection.credentialOwnerRef
        ) {
          fail(
            'route_authority_immutable',
            'Route selector, vendor, purpose, and credential owner require a new route ID'
          );
        }
        await validateRouteSecrets(tx, projection, now, true);
        await tx.slateProvisionedAppRouteProjection.update({
          where: { oid: existing.oid },
          data: {
            routeIdentifier: projection.routeIdentifier,
            vendor: projection.vendor,
            purpose: projection.purpose,
            credentialOwnerRef: projection.credentialOwnerRef,
            generation: projection.generation,
            routeSecretId: projection.routeSecretId,
            routeSecretVersion: projection.routeSecretVersion,
            vendorVerificationSecretId: projection.vendorVerificationSecretId,
            vendorVerificationVersion: projection.vendorVerificationVersion,
            status: projection.status,
            projectionDigest: parsed.digest,
            correlationId: envelope.correlationId,
            tombstonedAt: projection.tombstone ? now : null,
            tombstoneRetainUntil: parsed.tombstoneRetainUntil,
            expiresAt: parsed.expiresAt,
            receivedAt: now
          }
        });
      } else {
        if (projection.generation !== 1) {
          fail(
            'projection_generation_rejected',
            'First route projection must be generation 1'
          );
        }
        await validateRouteSecrets(tx, projection, now, true);
        await tx.slateProvisionedAppRouteProjection.create({
          data: {
            ...getId('slateProvisionedAppRouteProjection'),
            provisionedRouteId: projection.provisionedRouteId,
            routeIdentifier: projection.routeIdentifier,
            vendor: projection.vendor,
            purpose: projection.purpose,
            credentialOwnerRef: projection.credentialOwnerRef,
            generation: projection.generation,
            routeSecretId: projection.routeSecretId,
            routeSecretVersion: projection.routeSecretVersion,
            vendorVerificationSecretId: projection.vendorVerificationSecretId,
            vendorVerificationVersion: projection.vendorVerificationVersion,
            status: projection.status,
            projectionDigest: parsed.digest,
            correlationId: envelope.correlationId,
            tombstonedAt: projection.tombstone ? now : null,
            tombstoneRetainUntil: parsed.tombstoneRetainUntil,
            expiresAt: parsed.expiresAt,
            receivedAt: now
          }
        });
      }
      return {
        generation: projection.generation,
        projectionDigest: parsed.digest,
        idempotent: false
      };
    },
    { isolationLevel: 'Serializable' }
  );
};

let validateBindingShape = (projection: SlateProvisionedBindingProjectionV1) => {
  if (
    projection.entityKind !== 'binding' ||
    !projection.provisionedTenantAppId ||
    !projection.provisionedRouteId ||
    !projection.routeIdentifier ||
    !Number.isInteger(projection.routeGeneration) ||
    projection.routeGeneration <= 0 ||
    !projection.hubTenantId ||
    !projection.callbackInstanceId ||
    !projection.hubReceiverId ||
    !Number.isInteger(projection.hubReceiverGeneration) ||
    projection.hubReceiverGeneration <= 0 ||
    !projection.hubReceiverTriggerId ||
    !projection.triggerActionId ||
    !projection.triggerSpecHash ||
    projection.purpose !== 'shared_provisioned_app' ||
    !['managed', 'byo'].includes(projection.credentialOwnerType) ||
    !projection.credentialOwnerRef ||
    projection.credentialSecretPurpose !== HUB_PROVISIONED_TENANT_APP_SECRET_PURPOSE ||
    !Number.isInteger(projection.credentialVersion) ||
    projection.credentialVersion <= 0 ||
    !['pending', 'manifest_pending', 'installation_pending', 'active', 'tombstoned'].includes(
      projection.status
    ) ||
    projection.tombstone !== (projection.status === 'tombstoned')
  ) {
    fail('binding_projection_invalid', 'Tenant-app projection shape is invalid');
  }
  if (projection.status === 'active') {
    if (!projection.externalOwnershipKey || !projection.credentialSecretId) {
      fail('binding_projection_invalid', 'Active binding authority is incomplete');
    }
    let expected = buildSlateProvisionedExternalOwnershipKey(projection);
    if (projection.externalOwnershipKey !== expected) {
      fail('external_ownership_mismatch', 'External ownership identity is inconsistent');
    }
  }
};

let resolveBindingAuthority = async (
  tx: Prisma.TransactionClient,
  projection: SlateProvisionedBindingProjectionV1,
  now: Date
) => {
  let route = await tx.slateProvisionedAppRouteProjection.findUnique({
    where: { provisionedRouteId: projection.provisionedRouteId }
  });
  if (
    !route ||
    route.routeIdentifier !== projection.routeIdentifier ||
    route.generation !== projection.routeGeneration ||
    route.vendor !== projection.vendor ||
    route.purpose !== projection.purpose ||
    (!projection.tombstone &&
      (route.status !== 'active' ||
        route.tombstonedAt !== null ||
        (route.expiresAt !== null && route.expiresAt <= now)))
  ) {
    fail('route_projection_not_ready', 'Binding route projection is missing or stale');
  }
  let receiver = await tx.slateTriggerReceiver.findFirst({
    where: {
      id: projection.hubReceiverId,
      tenant: { id: projection.hubTenantId }
    },
    include: {
      tenant: true,
      triggers: {
        where: { id: projection.hubReceiverTriggerId },
        include: { action: true }
      }
    }
  });
  let trigger = receiver?.triggers[0];
  let actionContract = trigger?.action.spec as Record<string, any> | undefined;
  let publishedHash = actionContract?.specHash;
  let ingress = actionContract?.invocation?.http?.ingress;
  if (
    !receiver ||
    !trigger ||
    receiver.callbackInstanceId !== projection.callbackInstanceId ||
    trigger.registrationGeneration !== projection.hubReceiverGeneration ||
    trigger.action.key !== projection.triggerActionId ||
    trigger.verificationSpecHash !== projection.triggerSpecHash ||
    publishedHash !== projection.triggerSpecHash ||
    publishedHash !== currentActionSpecHash(actionContract ?? {}) ||
    ingress?.kind !== 'shared_provisioned_app' ||
    ingress?.verification?.mechanism !== 'hub' ||
    trigger.verificationMechanism !== 'hub' ||
    (!projection.tombstone &&
      (receiver.status !== 'active' ||
        receiver.tombstonedAt !== null ||
        trigger.tombstonedAt !== null))
  ) {
    fail(
      'binding_receiver_authority_mismatch',
      'Tenant, callback, receiver generation, action, or spec authority is invalid'
    );
  }
  if (projection.status === 'active') {
    let routeCredentialMatches =
      projection.credentialOwnerType === 'managed' &&
      projection.credentialOwnerRef === route.credentialOwnerRef &&
      projection.credentialSecretId === route.vendorVerificationSecretId &&
      projection.credentialVersion === route.vendorVerificationVersion;
    let triggerSecret =
      projection.credentialOwnerType === 'byo' && projection.credentialSecretId
        ? await tx.slateTriggerReceiverSecret.findFirst({
            where: {
              id: projection.credentialSecretId,
              secretVersion: projection.credentialVersion,
              tenantOid: receiver.tenantOid,
              receiverOid: receiver.oid,
              receiverTriggerOid: trigger.oid,
              sourceBindingType: 'provisioned_app',
              sourceBindingId: projection.provisionedTenantAppId,
              name: HUB_PROVISIONED_TENANT_APP_SECRET_PURPOSE,
              status: 'active',
              validFrom: { lte: now },
              OR: [{ validUntil: null }, { validUntil: { gt: now } }]
            }
          })
        : null;
    if (!routeCredentialMatches && !triggerSecret) {
      fail(
        'binding_credential_authority_mismatch',
        'Binding credential owner or opaque secret projection is invalid'
      );
    }
  }
  return { route, receiver, trigger };
};

export let projectSlateProvisionedTenantApp = async (
  envelope: SlateProvisionedProjectionEnvelope<SlateProvisionedBindingProjectionV1>,
  now = new Date()
) => {
  validateBindingShape(envelope.projection);
  let parsed = validateEnvelope(envelope);
  return await db.$transaction(
    async tx => {
      let projection = envelope.projection;
      let existing = await tx.slateProvisionedTenantAppProjection.findUnique({
        where: { provisionedTenantAppId: projection.provisionedTenantAppId }
      });
      if (existing) {
        if (projection.generation === existing.generation) {
          if (parsed.digest !== existing.projectionDigest) {
            fail('projection_digest_conflict', 'Same-generation binding digest conflict');
          }
          return {
            generation: existing.generation,
            projectionDigest: existing.projectionDigest,
            idempotent: true
          };
        }
        if (projection.generation !== existing.generation + 1) {
          fail(
            'projection_generation_rejected',
            'Binding projection is stale or out of order'
          );
        }
        if (existing.tombstonedAt && !projection.tombstone) {
          fail('binding_reprovision_required', 'A tombstoned binding requires a new ID');
        }
      }

      let authority = await resolveBindingAuthority(tx, projection, now);
      let ownershipMatch = projection.externalOwnershipKey
        ? await tx.slateProvisionedTenantAppProjection.findFirst({
            where: {
              routeProjectionOid: authority.route.oid,
              OR: [
                { externalOwnershipKey: projection.externalOwnershipKey },
                { retainedExternalOwnershipKey: projection.externalOwnershipKey }
              ]
            },
            orderBy: { generation: 'desc' }
          })
        : null;

      if (existing) {
        if (
          existing.routeProjectionOid !== authority.route.oid ||
          existing.routeIdentifier !== projection.routeIdentifier ||
          existing.tenantOid !== authority.receiver.tenantOid ||
          existing.receiverOid !== authority.receiver.oid ||
          existing.receiverTriggerOid !== authority.trigger.oid ||
          existing.callbackInstanceId !== projection.callbackInstanceId ||
          existing.hubReceiverGeneration !== projection.hubReceiverGeneration ||
          existing.triggerActionId !== projection.triggerActionId ||
          existing.triggerSpecHash !== projection.triggerSpecHash ||
          existing.vendor !== projection.vendor ||
          existing.purpose !== projection.purpose ||
          existing.credentialOwnerType !== projection.credentialOwnerType ||
          existing.credentialOwnerRef !== projection.credentialOwnerRef ||
          existing.credentialSecretId !== projection.credentialSecretId ||
          existing.credentialSecretPurpose !== projection.credentialSecretPurpose ||
          existing.credentialVersion !== projection.credentialVersion
        ) {
          fail(
            'binding_authority_immutable',
            'Binding owner, receiver generation, action/spec, vendor, selector, callback, and credential authority require tombstone plus a new ID'
          );
        }
        let ownershipFields = [
          'externalAppId',
          'externalAccountId',
          'externalInstallationId',
          'externalOwnershipKey',
          'ownerIdentity'
        ] as const;
        let ownershipChanged = ownershipFields.some(
          field => existing[field] !== projection[field]
        );
        if (ownershipChanged) {
          let lifecycleTransition = `${existing.status}->${projection.status}`;
          let stagedTransition = [
            'pending->active',
            'manifest_pending->installation_pending',
            'installation_pending->active'
          ].includes(lifecycleTransition);
          let overwroteAssignedIdentity = ownershipFields.some(
            field => existing[field] !== null && existing[field] !== projection[field]
          );
          if (
            existing.status === 'active' ||
            existing.externalOwnershipKey !== null ||
            existing.retainedExternalOwnershipKey !== null ||
            !stagedTransition ||
            overwroteAssignedIdentity ||
            (projection.externalOwnershipKey !== null && projection.status !== 'active')
          ) {
            fail(
              'binding_authority_immutable',
              'External ownership may only stage null fields during the exact pre-activation lifecycle; completed ownership requires tombstone plus a new ID'
            );
          }
        }
        await tx.slateProvisionedTenantAppProjection.update({
          where: { oid: existing.oid },
          data: {
            routeGeneration: projection.routeGeneration,
            externalAppId: projection.externalAppId,
            externalAccountId: projection.externalAccountId,
            externalInstallationId: projection.externalInstallationId,
            externalOwnershipKey: projection.tombstone
              ? null
              : projection.externalOwnershipKey,
            retainedExternalOwnershipKey: projection.tombstone
              ? projection.externalOwnershipKey
              : null,
            ownerIdentity: projection.ownerIdentity,
            generation: projection.generation,
            status: projection.status,
            projectionDigest: parsed.digest,
            correlationId: envelope.correlationId,
            tombstonedAt: projection.tombstone ? now : null,
            tombstoneRetainUntil: parsed.tombstoneRetainUntil,
            expiresAt: parsed.expiresAt,
            receivedAt: now
          }
        });
      } else {
        let minimumGeneration = ownershipMatch ? ownershipMatch.generation + 1 : 1;
        if (
          projection.generation !== minimumGeneration ||
          (ownershipMatch && ownershipMatch.tombstonedAt === null) ||
          (ownershipMatch &&
            projection.hubReceiverGeneration !== ownershipMatch.hubReceiverGeneration + 1)
        ) {
          fail(
            ownershipMatch
              ? ownershipMatch.tombstonedAt === null
                ? 'external_ownership_conflict'
                : 'binding_reprovision_required'
              : 'projection_generation_rejected',
            'External ownership is live or replacement generation is invalid'
          );
        }
        await tx.slateProvisionedTenantAppProjection.create({
          data: {
            ...getId('slateProvisionedTenantAppProjection'),
            provisionedTenantAppId: projection.provisionedTenantAppId,
            routeProjectionOid: authority.route.oid,
            routeIdentifier: projection.routeIdentifier,
            routeGeneration: projection.routeGeneration,
            tenantOid: authority.receiver.tenantOid,
            receiverOid: authority.receiver.oid,
            receiverTriggerOid: authority.trigger.oid,
            callbackInstanceId: projection.callbackInstanceId,
            hubReceiverGeneration: projection.hubReceiverGeneration,
            triggerActionId: projection.triggerActionId,
            triggerSpecHash: projection.triggerSpecHash,
            vendor: projection.vendor,
            purpose: projection.purpose,
            externalAppId: projection.externalAppId,
            externalAccountId: projection.externalAccountId,
            externalInstallationId: projection.externalInstallationId,
            externalOwnershipKey: projection.tombstone
              ? null
              : projection.externalOwnershipKey,
            retainedExternalOwnershipKey: projection.tombstone
              ? projection.externalOwnershipKey
              : null,
            ownerIdentity: projection.ownerIdentity,
            credentialOwnerType: projection.credentialOwnerType,
            credentialOwnerRef: projection.credentialOwnerRef,
            credentialSecretId: projection.credentialSecretId,
            credentialSecretPurpose: projection.credentialSecretPurpose,
            credentialVersion: projection.credentialVersion,
            generation: projection.generation,
            status: projection.status,
            projectionDigest: parsed.digest,
            correlationId: envelope.correlationId,
            tombstonedAt: projection.tombstone ? now : null,
            tombstoneRetainUntil: parsed.tombstoneRetainUntil,
            expiresAt: parsed.expiresAt,
            receivedAt: now
          }
        });
      }
      return {
        generation: projection.generation,
        projectionDigest: parsed.digest,
        idempotent: false
      };
    },
    { isolationLevel: 'Serializable' }
  );
};

export let getSlateProvisionedProjectionState = async (d: {
  entityKind: 'route' | 'binding';
  entityId: string;
}) => {
  if (d.entityKind === 'route') {
    let row = await db.slateProvisionedAppRouteProjection.findUnique({
      where: { provisionedRouteId: d.entityId },
      select: { generation: true, projectionDigest: true }
    });
    return row;
  }
  let row = await db.slateProvisionedTenantAppProjection.findUnique({
    where: { provisionedTenantAppId: d.entityId },
    select: { generation: true, projectionDigest: true }
  });
  return row;
};

export let resolveActiveSlateProvisionedAppRoute = async (d: {
  routeIdentifier: string;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let route = await db.slateProvisionedAppRouteProjection.findFirst({
    where: {
      routeIdentifier: d.routeIdentifier,
      status: 'active',
      tombstonedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    }
  });
  if (!route) fail('route_projection_not_ready', 'Route projection is unavailable');
  await validateRouteSecrets(
    db,
    {
      version: 1,
      entityKind: 'route',
      provisionedRouteId: route.provisionedRouteId,
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
      tombstone: false,
      tombstoneRetainUntil: null,
      expiresAt: route.expiresAt?.toISOString() ?? null
    },
    now,
    false
  );
  return route;
};

/**
 * Task 14 selector-only read. Unlike the Task 13 reconciliation resolver above, this performs
 * exactly one route-projection lookup and intentionally does not touch either credential row.
 * The shared router resolves and checks the path and vendor purposes in their mandatory order.
 */
export let resolveSelectedSlateProvisionedAppRouteForRouting = async (d: {
  routeIdentifier: string;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let route = await db.slateProvisionedAppRouteProjection.findUnique({
    where: { routeIdentifier: d.routeIdentifier }
  });
  if (
    !route ||
    route.status !== 'active' ||
    route.tombstonedAt !== null ||
    (route.expiresAt !== null && route.expiresAt <= now)
  ) {
    fail('route_projection_not_ready', 'Route projection is unavailable');
  }
  return route;
};

/// This resolver accepts only an authenticated vendor identity key. It has no
/// payload/query/header tenant selector parameter by construction.
export let resolveActiveSlateProvisionedTenantApp = async (d: {
  routeProjectionId: string;
  authenticatedExternalOwnershipKey: string;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let binding = await db.slateProvisionedTenantAppProjection.findFirst({
    where: {
      routeProjection: { id: d.routeProjectionId, status: 'active', tombstonedAt: null },
      externalOwnershipKey: d.authenticatedExternalOwnershipKey,
      status: 'active',
      tombstonedAt: null,
      receiverTrigger: {
        source: SlateTriggerReceiverTriggerSource.webhook,
        tombstonedAt: null,
        ingressDisabledAt: null
      },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    include: {
      routeProjection: true,
      tenant: true,
      receiver: true,
      receiverTrigger: { include: { action: true } }
    }
  });
  if (!binding) fail('binding_projection_not_ready', 'Tenant-app binding is unavailable');
  let route = binding.routeProjection;
  let actionSpec = binding.receiverTrigger.action.spec as Record<string, any>;
  let currentSpecHash = currentActionSpecHash(actionSpec);
  let ingress = actionSpec.invocation?.http?.ingress;
  if (
    route.status !== 'active' ||
    route.tombstonedAt ||
    (route.expiresAt !== null && route.expiresAt <= now) ||
    binding.routeGeneration !== route.generation ||
    binding.routeIdentifier !== route.routeIdentifier ||
    binding.vendor !== route.vendor ||
    binding.purpose !== route.purpose ||
    binding.receiver.status !== 'active' ||
    binding.receiver.tombstonedAt ||
    binding.receiver.callbackInstanceId !== binding.callbackInstanceId ||
    !isRoutableWebhookReceiverTrigger(binding.receiverTrigger) ||
    binding.receiverTrigger.registrationGeneration !== binding.hubReceiverGeneration ||
    binding.receiverTrigger.action.key !== binding.triggerActionId ||
    binding.receiverTrigger.verificationSpecHash !== binding.triggerSpecHash ||
    actionSpec.specHash !== binding.triggerSpecHash ||
    currentSpecHash !== binding.triggerSpecHash ||
    ingress?.kind !== 'shared_provisioned_app' ||
    ingress?.verification?.mechanism !== 'hub' ||
    binding.receiverTrigger.verificationMechanism !== 'hub'
  ) {
    fail('binding_projection_stale', 'Tenant-app binding no longer matches Hub authority');
  }
  await validateRouteSecrets(
    db,
    {
      version: 1,
      entityKind: 'route',
      provisionedRouteId: route.provisionedRouteId,
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
      tombstone: false,
      tombstoneRetainUntil: null,
      expiresAt: route.expiresAt?.toISOString() ?? null
    },
    now,
    false
  );
  let credentialValid =
    binding.credentialSecretPurpose === HUB_PROVISIONED_TENANT_APP_SECRET_PURPOSE &&
    (binding.credentialOwnerType === 'managed'
      ? binding.credentialOwnerRef === route.credentialOwnerRef &&
        binding.credentialSecretId === route.vendorVerificationSecretId &&
        binding.credentialVersion === route.vendorVerificationVersion
      : binding.credentialOwnerType === 'byo' &&
        binding.credentialSecretId !== null &&
        Boolean(
          await db.slateTriggerReceiverSecret.findFirst({
            where: {
              id: binding.credentialSecretId,
              secretVersion: binding.credentialVersion,
              tenantOid: binding.tenantOid,
              receiverOid: binding.receiverOid,
              receiverTriggerOid: binding.receiverTriggerOid,
              specHash: binding.triggerSpecHash,
              sourceBindingType: 'provisioned_app',
              sourceBindingId: binding.provisionedTenantAppId,
              name: HUB_PROVISIONED_TENANT_APP_SECRET_PURPOSE,
              status: 'active',
              validFrom: { lte: now },
              OR: [{ validUntil: null }, { validUntil: { gt: now } }]
            }
          })
        ));
  if (!credentialValid) {
    fail('binding_credential_authority_mismatch', 'Binding credential authority is stale');
  }
  return binding;
};

export let validateProvisionedTenantCredentialSecret = async (d: {
  provisionedTenantAppId: string;
  hubTenantId: string;
  callbackInstanceId: string;
  provisionedRouteId: string;
  routeGeneration: number;
  vendor: string;
  credentialOwnerRef: string;
  credentialSecretId: string;
  credentialSecretPurpose: typeof HUB_PROVISIONED_TENANT_APP_SECRET_PURPOSE;
  credentialVersion: number;
  hubReceiverId: string;
  hubReceiverGeneration: number;
  hubReceiverTriggerId: string;
  triggerActionId: string;
  triggerSpecHash: string;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  if (d.credentialSecretPurpose !== HUB_PROVISIONED_TENANT_APP_SECRET_PURPOSE) {
    fail('binding_credential_authority_mismatch', 'Provisioning secret purpose is invalid');
  }
  let binding = await db.slateProvisionedTenantAppProjection.findUnique({
    where: { provisionedTenantAppId: d.provisionedTenantAppId },
    include: {
      routeProjection: true,
      tenant: true,
      receiver: true,
      receiverTrigger: { include: { action: true } }
    }
  });
  if (!binding) {
    fail('binding_credential_authority_mismatch', 'BYO secret authority is invalid');
  }
  let trigger = binding.receiverTrigger;
  let secret = await db.slateTriggerReceiverSecret.findFirst({
    where: {
      id: d.credentialSecretId,
      secretVersion: d.credentialVersion,
      tenantOid: binding.tenantOid,
      receiverOid: binding.receiverOid,
      receiverTriggerOid: binding.receiverTriggerOid,
      specHash: d.triggerSpecHash,
      sourceBindingType: 'provisioned_app',
      sourceBindingId: d.provisionedTenantAppId,
      name: HUB_PROVISIONED_TENANT_APP_SECRET_PURPOSE,
      status: 'active',
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }]
    }
  });
  if (
    binding.credentialOwnerType !== 'byo' ||
    binding.credentialOwnerRef !== d.credentialOwnerRef ||
    binding.credentialSecretId !== d.credentialSecretId ||
    binding.credentialSecretPurpose !== d.credentialSecretPurpose ||
    binding.credentialVersion !== d.credentialVersion ||
    binding.routeProjection.provisionedRouteId !== d.provisionedRouteId ||
    binding.routeGeneration !== d.routeGeneration ||
    binding.routeProjection.generation !== d.routeGeneration ||
    binding.vendor !== d.vendor ||
    binding.tenant.id !== d.hubTenantId ||
    binding.callbackInstanceId !== d.callbackInstanceId ||
    binding.receiver.id !== d.hubReceiverId ||
    binding.receiver.callbackInstanceId !== d.callbackInstanceId ||
    binding.hubReceiverGeneration !== d.hubReceiverGeneration ||
    trigger.id !== d.hubReceiverTriggerId ||
    trigger.action.key !== d.triggerActionId ||
    binding.triggerSpecHash !== d.triggerSpecHash ||
    trigger.verificationSpecHash !== d.triggerSpecHash ||
    !secret
  ) {
    fail('binding_credential_authority_mismatch', 'BYO secret authority is invalid');
  }
  return { valid: true as const };
};

configureSlateProvisionedRouteAuthorityResolver({
  resolve: async d => {
    let route = await db.slateProvisionedAppRouteProjection.findUnique({
      where: { provisionedRouteId: d.provisionedRouteId }
    });
    if (!route || route.purpose !== 'shared_provisioned_app') {
      fail('route_projection_not_ready', 'Authoritative route projection is unavailable');
    }
    return {
      provisionedRouteId: route.provisionedRouteId,
      routeGeneration: route.generation,
      vendor: route.vendor,
      credentialOwnerRef: route.credentialOwnerRef,
      purpose: d.purpose,
      secretId:
        d.purpose === 'app_route_path'
          ? route.routeSecretId
          : route.vendorVerificationSecretId,
      secretVersion:
        d.purpose === 'app_route_path'
          ? route.routeSecretVersion
          : route.vendorVerificationVersion,
      status: route.status === 'active' && !route.tombstonedAt ? 'active' : 'inactive',
      expiresAt: route.expiresAt
    };
  }
});
