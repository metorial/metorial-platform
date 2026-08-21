import { createHash } from 'node:crypto';
import { canonicalizeJsonJcs } from '@slates/proto';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { secretService } from './secret';

export let HUB_PROVISIONED_APP_TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export class SlateProvisionedProjectionError extends Error {
  constructor(readonly code: 'invalid' | 'conflict' | 'stale' | 'unavailable') {
    super(`Provisioned app identity ${code}`);
    this.name = 'SlateProvisionedProjectionError';
  }
}

export let canonicalSlateProvisionedProjection = (value: unknown) =>
  canonicalizeJsonJcs(value);

export let digestSlateProvisionedProjection = (value: unknown) =>
  `sha256:${createHash('sha256')
    .update(canonicalSlateProvisionedProjection(value))
    .digest('hex')}`;

export let buildSlateProvisionedExternalOwnershipKey = (d: {
  vendor: string;
  externalAppId?: string;
  externalAccountId?: string;
  externalInstallationId?: string;
}) => {
  let identity = {
    vendor: d.vendor.trim().toLowerCase(),
    externalAppId: d.externalAppId?.trim() || null,
    externalAccountId: d.externalAccountId?.trim() || null,
    externalInstallationId: d.externalInstallationId?.trim() || null
  };
  if (
    !identity.vendor ||
    (!identity.externalAppId &&
      !identity.externalAccountId &&
      !identity.externalInstallationId)
  ) {
    throw new SlateProvisionedProjectionError('invalid');
  }
  return createHash('sha256')
    .update('provisioned-external-owner/v1\0')
    .update(canonicalSlateProvisionedProjection(identity))
    .digest('hex');
};

export type SlateProvisionedRouteIdentityInput = {
  provisionedRouteId: string;
  routeIdentifier: string;
  vendor: string;
  purpose: 'shared_provisioned_app';
  oauthCredentialsId?: string | null;
  authConfigId?: string | null;
  generation: number;
  status: 'active' | 'tombstoned';
  correlationId: string;
  expiresAt?: Date | null;
};

export type SlateProvisionedBindingIdentityInput = {
  provisionedTenantAppId: string;
  provisionedRouteId: string;
  tenantId: string;
  receiverId: string;
  receiverTriggerId: string;
  callbackInstanceId: string;
  hubReceiverGeneration: number;
  triggerActionId: string;
  triggerSpecHash: string;
  vendor: string;
  externalAppId?: string | null;
  externalAccountId?: string | null;
  externalInstallationId?: string | null;
  ownerIdentity?: string | null;
  authConfigId?: string | null;
  generation: number;
  status: 'active' | 'tombstoned';
  correlationId: string;
  expiresAt?: Date | null;
};

let validGeneration = (generation: number) => Number.isInteger(generation) && generation > 0;

let routeDigestInput = (input: SlateProvisionedRouteIdentityInput) => ({
  provisionedRouteId: input.provisionedRouteId,
  routeIdentifier: input.routeIdentifier,
  vendor: input.vendor.trim().toLowerCase(),
  purpose: input.purpose,
  oauthCredentialsId: input.oauthCredentialsId ?? null,
  authConfigId: input.authConfigId ?? null,
  generation: input.generation,
  status: input.status,
  expiresAt: input.expiresAt?.toISOString() ?? null
});

let bindingDigestInput = (
  input: SlateProvisionedBindingIdentityInput,
  externalOwnershipKey: string | null
) => ({
  provisionedTenantAppId: input.provisionedTenantAppId,
  provisionedRouteId: input.provisionedRouteId,
  tenantId: input.tenantId,
  receiverId: input.receiverId,
  receiverTriggerId: input.receiverTriggerId,
  callbackInstanceId: input.callbackInstanceId,
  hubReceiverGeneration: input.hubReceiverGeneration,
  triggerActionId: input.triggerActionId,
  triggerSpecHash: input.triggerSpecHash,
  vendor: input.vendor.trim().toLowerCase(),
  externalOwnershipKey,
  ownerIdentity: input.ownerIdentity ?? null,
  authConfigId: input.authConfigId ?? null,
  generation: input.generation,
  status: input.status,
  expiresAt: input.expiresAt?.toISOString() ?? null
});

let routeInclude = {
  oauthCredentials: { include: { secret: true, tenant: true } },
  authConfig: { include: { secret: true, tenant: true } }
} as const;

let bindingInclude = {
  routeProjection: true,
  tenant: true,
  receiver: true,
  receiverTrigger: { include: { action: true } },
  authConfig: true
} as const;

export let projectSlateProvisionedAppRoute = async (
  input: SlateProvisionedRouteIdentityInput,
  d: { now?: Date; expectedTenantOid?: bigint } = {}
) => {
  let now = d.now ?? new Date();
  if (
    !input.provisionedRouteId ||
    !input.routeIdentifier ||
    !input.vendor ||
    input.purpose !== 'shared_provisioned_app' ||
    !input.correlationId ||
    !validGeneration(input.generation) ||
    (!input.oauthCredentialsId && !input.authConfigId)
  )
    throw new SlateProvisionedProjectionError('invalid');

  let [oauthCredentials, authConfig] = await Promise.all([
    input.oauthCredentialsId
      ? db.slateOAuthCredentials.findUnique({ where: { id: input.oauthCredentialsId } })
      : null,
    input.authConfigId
      ? db.slateAuthConfig.findUnique({ where: { id: input.authConfigId } })
      : null
  ]);
  if (
    (input.oauthCredentialsId && !oauthCredentials) ||
    (input.authConfigId && !authConfig) ||
    (oauthCredentials && authConfig && oauthCredentials.tenantOid !== authConfig.tenantOid) ||
    (d.expectedTenantOid !== undefined &&
      ((oauthCredentials && oauthCredentials.tenantOid !== d.expectedTenantOid) ||
        (authConfig && authConfig.tenantOid !== d.expectedTenantOid)))
  )
    throw new SlateProvisionedProjectionError('invalid');

  let digest = digestSlateProvisionedProjection(routeDigestInput(input));
  return await db.$transaction(async tx => {
    let existing = await tx.slateProvisionedAppRouteProjection.findUnique({
      where: { provisionedRouteId: input.provisionedRouteId }
    });
    let selector = await tx.slateProvisionedAppRouteProjection.findUnique({
      where: { routeIdentifier: input.routeIdentifier }
    });
    if (selector && selector.provisionedRouteId !== input.provisionedRouteId) {
      throw new SlateProvisionedProjectionError('conflict');
    }
    if (existing) {
      if (input.generation < existing.generation) {
        throw new SlateProvisionedProjectionError('stale');
      }
      if (input.generation === existing.generation) {
        if (existing.projectionDigest !== digest) {
          throw new SlateProvisionedProjectionError('conflict');
        }
        return await tx.slateProvisionedAppRouteProjection.findUniqueOrThrow({
          where: { oid: existing.oid },
          include: routeInclude
        });
      }
      return await tx.slateProvisionedAppRouteProjection.update({
        where: { oid: existing.oid },
        data: {
          routeIdentifier: input.routeIdentifier,
          vendor: input.vendor.trim().toLowerCase(),
          purpose: input.purpose,
          oauthCredentialsOid: oauthCredentials?.oid ?? null,
          authConfigOid: authConfig?.oid ?? null,
          generation: input.generation,
          status: input.status,
          projectionDigest: digest,
          correlationId: input.correlationId,
          tombstonedAt: input.status === 'tombstoned' ? now : null,
          tombstoneRetainUntil:
            input.status === 'tombstoned'
              ? new Date(now.getTime() + HUB_PROVISIONED_APP_TOMBSTONE_RETENTION_MS)
              : null,
          expiresAt: input.expiresAt ?? null,
          receivedAt: now
        },
        include: routeInclude
      });
    }
    return await tx.slateProvisionedAppRouteProjection.create({
      data: {
        ...getId('slateProvisionedAppRouteProjection'),
        provisionedRouteId: input.provisionedRouteId,
        routeIdentifier: input.routeIdentifier,
        vendor: input.vendor.trim().toLowerCase(),
        purpose: input.purpose,
        oauthCredentialsOid: oauthCredentials?.oid ?? null,
        authConfigOid: authConfig?.oid ?? null,
        generation: input.generation,
        status: input.status,
        projectionDigest: digest,
        correlationId: input.correlationId,
        tombstonedAt: input.status === 'tombstoned' ? now : null,
        tombstoneRetainUntil:
          input.status === 'tombstoned'
            ? new Date(now.getTime() + HUB_PROVISIONED_APP_TOMBSTONE_RETENTION_MS)
            : null,
        expiresAt: input.expiresAt ?? null,
        receivedAt: now
      },
      include: routeInclude
    });
  });
};

export let projectSlateProvisionedTenantApp = async (
  input: SlateProvisionedBindingIdentityInput,
  d: { now?: Date } = {}
) => {
  let now = d.now ?? new Date();
  if (
    !input.provisionedTenantAppId ||
    !input.provisionedRouteId ||
    !input.tenantId ||
    !input.receiverId ||
    !input.receiverTriggerId ||
    !input.callbackInstanceId ||
    !input.triggerActionId ||
    !/^[a-f0-9]{64}$/.test(input.triggerSpecHash) ||
    !input.vendor ||
    !input.correlationId ||
    !validGeneration(input.generation) ||
    !validGeneration(input.hubReceiverGeneration)
  )
    throw new SlateProvisionedProjectionError('invalid');

  let route = await db.slateProvisionedAppRouteProjection.findUnique({
    where: { provisionedRouteId: input.provisionedRouteId }
  });
  let tenant = await db.tenant.findUnique({ where: { id: input.tenantId } });
  let receiver = await db.slateTriggerReceiver.findUnique({ where: { id: input.receiverId } });
  let receiverTrigger = await db.slateTriggerReceiverTrigger.findUnique({
    where: { id: input.receiverTriggerId },
    include: { action: true }
  });
  let authConfig = input.authConfigId
    ? await db.slateAuthConfig.findUnique({ where: { id: input.authConfigId } })
    : null;
  if (
    !route ||
    !tenant ||
    !receiver ||
    !receiverTrigger ||
    receiver.tenantOid !== tenant.oid ||
    receiver.callbackInstanceId !== input.callbackInstanceId ||
    receiverTrigger.receiverOid !== receiver.oid ||
    receiverTrigger.action.key !== input.triggerActionId ||
    receiverTrigger.verificationSpecHash !== input.triggerSpecHash ||
    receiverTrigger.registrationGeneration !== input.hubReceiverGeneration ||
    route.vendor !== input.vendor.trim().toLowerCase() ||
    (input.authConfigId && (!authConfig || authConfig.tenantOid !== tenant.oid))
  )
    throw new SlateProvisionedProjectionError('invalid');

  let externalOwnershipKey =
    input.status === 'active'
      ? buildSlateProvisionedExternalOwnershipKey({
          vendor: input.vendor,
          externalAppId: input.externalAppId ?? undefined,
          externalAccountId: input.externalAccountId ?? undefined,
          externalInstallationId: input.externalInstallationId ?? undefined
        })
      : null;
  let digest = digestSlateProvisionedProjection(
    bindingDigestInput(input, externalOwnershipKey)
  );

  return await db.$transaction(async tx => {
    let existing = await tx.slateProvisionedTenantAppProjection.findUnique({
      where: { provisionedTenantAppId: input.provisionedTenantAppId }
    });
    if (existing) {
      if (input.generation < existing.generation) {
        throw new SlateProvisionedProjectionError('stale');
      }
      if (input.generation === existing.generation) {
        if (existing.projectionDigest !== digest) {
          throw new SlateProvisionedProjectionError('conflict');
        }
        return await tx.slateProvisionedTenantAppProjection.findUniqueOrThrow({
          where: { oid: existing.oid },
          include: bindingInclude
        });
      }
      return await tx.slateProvisionedTenantAppProjection.update({
        where: { oid: existing.oid },
        data: {
          routeProjectionOid: route.oid,
          routeIdentifier: route.routeIdentifier,
          routeGeneration: route.generation,
          tenantOid: tenant.oid,
          receiverOid: receiver.oid,
          receiverTriggerOid: receiverTrigger.oid,
          callbackInstanceId: input.callbackInstanceId,
          hubReceiverGeneration: input.hubReceiverGeneration,
          triggerActionId: input.triggerActionId,
          triggerSpecHash: input.triggerSpecHash,
          vendor: input.vendor.trim().toLowerCase(),
          purpose: 'shared_provisioned_app',
          externalAppId: input.externalAppId ?? null,
          externalAccountId: input.externalAccountId ?? null,
          externalInstallationId: input.externalInstallationId ?? null,
          externalOwnershipKey,
          retainedExternalOwnershipKey:
            input.status === 'tombstoned'
              ? (existing.externalOwnershipKey ?? existing.retainedExternalOwnershipKey)
              : null,
          ownerIdentity: input.ownerIdentity ?? null,
          authConfigOid: authConfig?.oid ?? null,
          generation: input.generation,
          status: input.status,
          projectionDigest: digest,
          correlationId: input.correlationId,
          tombstonedAt: input.status === 'tombstoned' ? now : null,
          tombstoneRetainUntil:
            input.status === 'tombstoned'
              ? new Date(now.getTime() + HUB_PROVISIONED_APP_TOMBSTONE_RETENTION_MS)
              : null,
          expiresAt: input.expiresAt ?? null,
          receivedAt: now
        },
        include: bindingInclude
      });
    }
    return await tx.slateProvisionedTenantAppProjection.create({
      data: {
        ...getId('slateProvisionedTenantAppProjection'),
        provisionedTenantAppId: input.provisionedTenantAppId,
        routeProjectionOid: route.oid,
        routeIdentifier: route.routeIdentifier,
        routeGeneration: route.generation,
        tenantOid: tenant.oid,
        receiverOid: receiver.oid,
        receiverTriggerOid: receiverTrigger.oid,
        callbackInstanceId: input.callbackInstanceId,
        hubReceiverGeneration: input.hubReceiverGeneration,
        triggerActionId: input.triggerActionId,
        triggerSpecHash: input.triggerSpecHash,
        vendor: input.vendor.trim().toLowerCase(),
        purpose: 'shared_provisioned_app',
        externalAppId: input.externalAppId ?? null,
        externalAccountId: input.externalAccountId ?? null,
        externalInstallationId: input.externalInstallationId ?? null,
        externalOwnershipKey,
        retainedExternalOwnershipKey:
          input.status === 'tombstoned' ? externalOwnershipKey : null,
        ownerIdentity: input.ownerIdentity ?? null,
        authConfigOid: authConfig?.oid ?? null,
        generation: input.generation,
        status: input.status,
        projectionDigest: digest,
        correlationId: input.correlationId,
        tombstonedAt: input.status === 'tombstoned' ? now : null,
        tombstoneRetainUntil:
          input.status === 'tombstoned'
            ? new Date(now.getTime() + HUB_PROVISIONED_APP_TOMBSTONE_RETENTION_MS)
            : null,
        expiresAt: input.expiresAt ?? null,
        receivedAt: now
      },
      include: bindingInclude
    });
  });
};

export let getSlateProvisionedProjectionState = async (d: {
  entityKind: 'route' | 'tenant_app';
  entityId: string;
}) =>
  d.entityKind === 'route'
    ? await db.slateProvisionedAppRouteProjection.findUnique({
        where: { provisionedRouteId: d.entityId }
      })
    : await db.slateProvisionedTenantAppProjection.findUnique({
        where: { provisionedTenantAppId: d.entityId }
      });

export let getSlateProvisionedProjectionStateForTenant = async (d: {
  tenant: Tenant;
  entityKind: 'route' | 'tenant_app';
  entityId: string;
}) => {
  if (d.entityKind === 'route') {
    let route = await db.slateProvisionedAppRouteProjection.findUnique({
      where: { provisionedRouteId: d.entityId },
      include: { oauthCredentials: true, authConfig: true }
    });
    if (
      !route ||
      (route.oauthCredentials && route.oauthCredentials.tenantOid !== d.tenant.oid) ||
      (route.authConfig && route.authConfig.tenantOid !== d.tenant.oid) ||
      (!route.oauthCredentials && !route.authConfig)
    ) {
      throw new SlateProvisionedProjectionError('unavailable');
    }
    return route;
  }

  let binding = await db.slateProvisionedTenantAppProjection.findUnique({
    where: { provisionedTenantAppId: d.entityId },
    include: { routeProjection: true, tenant: true, receiver: true, receiverTrigger: true }
  });
  if (!binding || binding.tenantOid !== d.tenant.oid) {
    throw new SlateProvisionedProjectionError('unavailable');
  }
  return binding;
};

export let resolveActiveSlateProvisionedAppRoute = async (d: {
  routeIdentifier: string;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let route = await db.slateProvisionedAppRouteProjection.findUnique({
    where: { routeIdentifier: d.routeIdentifier },
    include: routeInclude
  });
  if (
    !route ||
    route.status !== 'active' ||
    route.tombstonedAt ||
    route.purpose !== 'shared_provisioned_app' ||
    (route.expiresAt && route.expiresAt <= now)
  )
    throw new SlateProvisionedProjectionError('unavailable');
  return route;
};

export let resolveSelectedSlateProvisionedAppRouteForRouting =
  resolveActiveSlateProvisionedAppRoute;

export let resolveActiveSlateProvisionedTenantApp = async (d: {
  routeIdentityId: string;
  authenticatedExternalOwnershipKey: string;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let binding = await db.slateProvisionedTenantAppProjection.findFirst({
    where: {
      routeProjection: { id: d.routeIdentityId },
      externalOwnershipKey: d.authenticatedExternalOwnershipKey
    },
    include: bindingInclude
  });
  if (
    !binding ||
    binding.status !== 'active' ||
    binding.tombstonedAt ||
    (binding.expiresAt && binding.expiresAt <= now)
  )
    throw new SlateProvisionedProjectionError('unavailable');
  return binding;
};

let nestedString = (value: unknown, paths: string[]) => {
  for (let path of paths) {
    let current: unknown = value;
    for (let part of path.split('.')) {
      current =
        current && typeof current === 'object' && !Array.isArray(current)
          ? (current as Record<string, unknown>)[part]
          : undefined;
    }
    if (typeof current === 'string' && current.length > 0) return current;
  }
  return null;
};

export let resolveSlateProvisionedRouteSecrets = async (d: {
  route: Awaited<ReturnType<typeof resolveActiveSlateProvisionedAppRoute>>;
  purpose: 'app_route_path' | 'vendor_verification';
}) => {
  let authMaterial = d.route.authConfig
    ? await secretService.DANGEROUSLY_decryptSecret({
        tenant: d.route.authConfig.tenant,
        secret: d.route.authConfig.secret,
        purpose: 'slate_authentication_configuration',
        note: `Resolve shared-app ${d.purpose} for ${d.route.provisionedRouteId}`
      })
    : null;
  let oauthMaterial = d.route.oauthCredentials
    ? await secretService.DANGEROUSLY_decryptSecret({
        tenant: d.route.oauthCredentials.tenant,
        secret: d.route.oauthCredentials.secret,
        purpose: 'slate_oauth_credentials',
        note: `Resolve shared-app ${d.purpose} for ${d.route.provisionedRouteId}`
      })
    : null;

  let authValue =
    d.purpose === 'app_route_path'
      ? nestedString(authMaterial, [
          'output.callbackPathSecret',
          'output.webhookPathSecret',
          'output.pathSecret',
          'input.callbackPathSecret',
          'input.webhookPathSecret',
          'input.pathSecret'
        ])
      : nestedString(authMaterial, [
          'output.webhookSigningSecret',
          'output.signingSecret',
          'output.appSecret',
          'output.clientSecret',
          'input.webhookSigningSecret',
          'input.signingSecret',
          'input.appSecret',
          'input.clientSecret'
        ]);
  let value =
    d.purpose === 'app_route_path'
      ? (authValue ?? oauthMaterial?.clientSecret ?? null)
      : (authValue ?? oauthMaterial?.clientSecret ?? null);
  let secret =
    authValue && d.route.authConfig
      ? d.route.authConfig.secret
      : d.route.oauthCredentials?.secret;
  if (!value || !secret) throw new SlateProvisionedProjectionError('unavailable');
  return [{ id: secret.id, purpose: d.purpose, plaintext: value }];
};

export let validateProvisionedTenantCredentialSecret = async (d: {
  provisionedTenantAppId: string;
  authConfigId: string;
  provisionedRouteId: string;
}) => {
  let binding = await db.slateProvisionedTenantAppProjection.findUnique({
    where: { provisionedTenantAppId: d.provisionedTenantAppId },
    include: { authConfig: true, routeProjection: true }
  });
  if (
    !binding ||
    binding.authConfig?.id !== d.authConfigId ||
    binding.routeProjection.provisionedRouteId !== d.provisionedRouteId ||
    binding.status !== 'active'
  )
    throw new SlateProvisionedProjectionError('unavailable');
  return binding.authConfig;
};
