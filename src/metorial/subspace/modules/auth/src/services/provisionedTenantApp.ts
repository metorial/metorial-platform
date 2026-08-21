import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type CallbackInstance,
  type Tenant,
  type TransactionDB
} from '@metorial-subspace/db';
import { getTenantForSlates, slates } from '@metorial-subspace/provider-slates/src/client';

let invalidMetadata = (message: string) =>
  new ServiceError(
    badRequestError({
      code: 'invalid_provisioned_app_metadata',
      message
    })
  );

export let tombstoneProvisionedTenantAppsForCallbackInTransaction = async (
  tx: TransactionDB,
  callbackInstanceOid: bigint,
  now = new Date()
) => {
  await tx.provisionedTenantApp.updateMany({
    where: {
      callbackInstanceOid,
      status: 'active'
    },
    data: {
      status: 'tombstoned',
      tombstonedAt: now,
      generation: { increment: 1 }
    }
  });
};

class provisionedTenantAppServiceImpl {
  private async projectRoute(routeId: string) {
    let route = await db.provisionedVendorAppRoute.findUniqueOrThrow({
      where: { id: routeId },
      include: {
        slateOAuthCredentials: { include: { tenant: true } },
        pinnedProviderAuthConfig: {
          include: {
            currentVersion: { include: { slateAuthConfig: { include: { tenant: true } } } }
          }
        }
      }
    });
    let tenant =
      route.slateOAuthCredentials?.tenant ??
      route.pinnedProviderAuthConfig?.currentVersion?.slateAuthConfig?.tenant;
    if (!tenant) throw invalidMetadata('The route has no Hub credential authority.');
    let hubTenant = await getTenantForSlates(tenant);
    await slates.provisionedAppProjection.upsertRoute({
      tenantId: hubTenant.id,
      provisionedRouteId: route.id,
      routeIdentifier: route.routeIdentifier,
      vendor: route.vendor,
      purpose: 'shared_provisioned_app',
      oauthCredentialsId: route.slateOAuthCredentials?.id ?? null,
      authConfigId:
        route.pinnedProviderAuthConfig?.currentVersion?.slateAuthConfig?.id ?? null,
      generation: route.generation,
      status: route.status,
      correlationId: route.correlationId,
      expiresAt: route.expiresAt
    });
    return route;
  }

  async upsertRouteMetadata(d: {
    routeId?: string;
    input: {
      routeIdentifier: string;
      vendor: string;
      providerAuthCredentialsId?: string | null;
      slateOAuthCredentialsId?: string | null;
      providerAuthConfigId?: string | null;
      correlationId: string;
      metadata?: Record<string, unknown> | null;
      expiresAt?: Date | null;
    };
  }) {
    if (
      !d.input.providerAuthCredentialsId &&
      !d.input.slateOAuthCredentialsId &&
      !d.input.providerAuthConfigId
    ) {
      throw invalidMetadata('A route must reference existing provider credentials.');
    }

    let [providerCredentials, slateCredentials, authConfig] = await Promise.all([
      d.input.providerAuthCredentialsId
        ? db.providerAuthCredentials.findUnique({
            where: { id: d.input.providerAuthCredentialsId },
            include: { slateCredentials: true }
          })
        : null,
      d.input.slateOAuthCredentialsId
        ? db.slateOAuthCredentials.findUnique({
            where: { id: d.input.slateOAuthCredentialsId }
          })
        : null,
      d.input.providerAuthConfigId
        ? db.providerAuthConfig.findUnique({
            where: { id: d.input.providerAuthConfigId },
            include: {
              currentVersion: {
                include: { slateAuthConfig: true }
              }
            }
          })
        : null
    ]);
    if (
      (d.input.providerAuthCredentialsId && !providerCredentials) ||
      (d.input.slateOAuthCredentialsId && !slateCredentials) ||
      (d.input.providerAuthConfigId && !authConfig)
    ) {
      throw invalidMetadata('One or more referenced provider credentials do not exist.');
    }

    let slateOAuthCredentials = slateCredentials ?? providerCredentials?.slateCredentials;
    if (!slateOAuthCredentials && !authConfig?.currentVersion?.slateAuthConfig) {
      throw invalidMetadata('The referenced credentials are not available in Hub.');
    }

    let existing = d.routeId
      ? await db.provisionedVendorAppRoute.findUnique({ where: { id: d.routeId } })
      : await db.provisionedVendorAppRoute.findUnique({
          where: { routeIdentifier: d.input.routeIdentifier }
        });
    let data = {
      routeIdentifier: d.input.routeIdentifier,
      vendor: d.input.vendor.trim().toLowerCase(),
      purpose: 'shared_provisioned_app',
      providerAuthCredentialsOid: providerCredentials?.oid ?? null,
      slateOAuthCredentialsOid: slateOAuthCredentials?.oid ?? null,
      pinnedProviderAuthConfigOid: authConfig?.oid ?? null,
      status: 'active' as const,
      correlationId: d.input.correlationId,
      metadata: d.input.metadata,
      expiresAt: d.input.expiresAt,
      tombstonedAt: null
    };

    let route = existing
      ? await db.provisionedVendorAppRoute.update({
          where: { oid: existing.oid },
          data: { ...data, generation: { increment: 1 } }
        })
      : await db.provisionedVendorAppRoute.create({
          data: {
            ...getId('provisionedVendorAppRoute'),
            ...data,
            generation: 1
          }
        });
    await this.projectRoute(route.id);
    return route;
  }

  async upsertTenantAppMetadata(d: {
    tenant: Tenant;
    callbackInstance: CallbackInstance;
    tenantAppId?: string;
    input: {
      routeId: string;
      providerAuthConfigId?: string | null;
      hubReceiverId: string;
      hubReceiverGeneration: number;
      hubReceiverTriggerId: string;
      triggerActionId: string;
      triggerSpecHash: string;
      vendor: string;
      externalAppId?: string | null;
      externalAccountId?: string | null;
      externalInstallationId?: string | null;
      externalOwnershipKey?: string | null;
      ownerIdentity?: string | null;
      correlationId: string;
      metadata?: Record<string, unknown> | null;
      expiresAt?: Date | null;
    };
  }) {
    let route = await db.provisionedVendorAppRoute.findFirst({
      where: { id: d.input.routeId, status: 'active' }
    });
    if (!route) {
      throw new ServiceError(notFoundError('provider.provisioned_app_route', d.input.routeId));
    }
    if (route.vendor !== d.input.vendor.trim().toLowerCase()) {
      throw invalidMetadata('The tenant app vendor does not match its route.');
    }
    if (
      !Number.isInteger(d.input.hubReceiverGeneration) ||
      d.input.hubReceiverGeneration < 1 ||
      !/^[a-f0-9]{64}$/.test(d.input.triggerSpecHash)
    ) {
      throw invalidMetadata('The Hub receiver metadata is invalid.');
    }

    let authConfig = d.input.providerAuthConfigId
      ? await db.providerAuthConfig.findFirst({
          where: {
            id: d.input.providerAuthConfigId,
            tenantOid: d.tenant.oid,
            status: 'active'
          },
          include: {
            currentVersion: {
              include: { slateAuthConfig: true }
            }
          }
        })
      : null;
    if (d.input.providerAuthConfigId && !authConfig?.currentVersion?.slateAuthConfig) {
      throw invalidMetadata('The pinned auth config is not active in Hub.');
    }

    let existing = d.tenantAppId
      ? await db.provisionedTenantApp.findFirst({
          where: {
            id: d.tenantAppId,
            tenantOid: d.tenant.oid,
            callbackInstanceOid: d.callbackInstance.oid
          }
        })
      : null;
    if (d.tenantAppId && !existing) {
      throw new ServiceError(notFoundError('provider.provisioned_tenant_app', d.tenantAppId));
    }
    let data = {
      tenantOid: d.tenant.oid,
      callbackInstanceOid: d.callbackInstance.oid,
      vendorAppRouteOid: route.oid,
      pinnedProviderAuthConfigOid: authConfig?.oid ?? null,
      hubReceiverId: d.input.hubReceiverId,
      hubReceiverGeneration: d.input.hubReceiverGeneration,
      hubReceiverTriggerId: d.input.hubReceiverTriggerId,
      triggerActionId: d.input.triggerActionId,
      triggerSpecHash: d.input.triggerSpecHash,
      vendor: route.vendor,
      externalAppId: d.input.externalAppId,
      externalAccountId: d.input.externalAccountId,
      externalInstallationId: d.input.externalInstallationId,
      externalOwnershipKey: d.input.externalOwnershipKey,
      ownerIdentity: d.input.ownerIdentity,
      status: 'active' as const,
      correlationId: d.input.correlationId,
      metadata: d.input.metadata,
      expiresAt: d.input.expiresAt,
      tombstonedAt: null
    };

    let tenantApp = existing
      ? await db.provisionedTenantApp.update({
          where: { oid: existing.oid },
          data: { ...data, generation: { increment: 1 } }
        })
      : await db.provisionedTenantApp.create({
          data: {
            ...getId('provisionedTenantApp'),
            ...data,
            generation: 1
          }
        });
    await this.projectRoute(route.id);
    let hubTenant = await getTenantForSlates(d.tenant);
    await slates.provisionedAppProjection.upsertTenantApp({
      tenantId: hubTenant.id,
      provisionedTenantAppId: tenantApp.id,
      provisionedRouteId: route.id,
      receiverId: tenantApp.hubReceiverId,
      receiverTriggerId: tenantApp.hubReceiverTriggerId,
      callbackInstanceId: d.callbackInstance.id,
      hubReceiverGeneration: tenantApp.hubReceiverGeneration,
      triggerActionId: tenantApp.triggerActionId,
      triggerSpecHash: tenantApp.triggerSpecHash,
      vendor: tenantApp.vendor,
      externalAppId: tenantApp.externalAppId,
      externalAccountId: tenantApp.externalAccountId,
      externalInstallationId: tenantApp.externalInstallationId,
      ownerIdentity: tenantApp.ownerIdentity,
      authConfigId: authConfig?.currentVersion?.slateAuthConfig?.id ?? null,
      generation: tenantApp.generation,
      status: tenantApp.status,
      correlationId: tenantApp.correlationId,
      expiresAt: tenantApp.expiresAt
    });
    return tenantApp;
  }

  async tombstoneRoute(d: { routeId: string }) {
    let route = await db.provisionedVendorAppRoute.findUnique({
      where: { id: d.routeId }
    });
    if (!route) {
      throw new ServiceError(notFoundError('provider.provisioned_app_route', d.routeId));
    }
    if (route.status === 'tombstoned') return route;
    let tombstoned = await db.provisionedVendorAppRoute.update({
      where: { oid: route.oid },
      data: {
        status: 'tombstoned',
        generation: { increment: 1 },
        tombstonedAt: new Date()
      }
    });
    await this.projectRoute(tombstoned.id);
    return tombstoned;
  }

  async getTenantAppForUse(d: { tenant: Tenant; tenantAppId: string }) {
    let app = await db.provisionedTenantApp.findFirst({
      where: { id: d.tenantAppId, tenantOid: d.tenant.oid, status: 'active' }
    });
    if (!app) {
      throw new ServiceError(notFoundError('provider.provisioned_tenant_app', d.tenantAppId));
    }
    let hubTenant = await getTenantForSlates(d.tenant);
    await slates.provisionedAppProjection.get({
      tenantId: hubTenant.id,
      entityKind: 'tenant_app',
      entityId: app.id
    });
    return app;
  }

  async tombstoneTenantApp(d: { tenant: Tenant; tenantAppId: string }) {
    let app = await db.provisionedTenantApp.findFirst({
      where: { id: d.tenantAppId, tenantOid: d.tenant.oid }
    });
    if (!app) {
      throw new ServiceError(notFoundError('provider.provisioned_tenant_app', d.tenantAppId));
    }
    if (app.status === 'tombstoned') return app;
    let tombstoned = await db.provisionedTenantApp.update({
      where: { oid: app.oid },
      data: {
        status: 'tombstoned',
        generation: { increment: 1 },
        tombstonedAt: new Date()
      }
    });
    let projected = await db.provisionedTenantApp.findUniqueOrThrow({
      where: { oid: tombstoned.oid },
      include: {
        vendorAppRoute: true,
        callbackInstance: true,
        pinnedProviderAuthConfig: {
          include: { currentVersion: { include: { slateAuthConfig: true } } }
        }
      }
    });
    await this.projectRoute(projected.vendorAppRoute.id);
    let hubTenant = await getTenantForSlates(d.tenant);
    await slates.provisionedAppProjection.upsertTenantApp({
      tenantId: hubTenant.id,
      provisionedTenantAppId: projected.id,
      provisionedRouteId: projected.vendorAppRoute.id,
      receiverId: projected.hubReceiverId,
      receiverTriggerId: projected.hubReceiverTriggerId,
      callbackInstanceId: projected.callbackInstance.id,
      hubReceiverGeneration: projected.hubReceiverGeneration,
      triggerActionId: projected.triggerActionId,
      triggerSpecHash: projected.triggerSpecHash,
      vendor: projected.vendor,
      externalAppId: projected.externalAppId,
      externalAccountId: projected.externalAccountId,
      externalInstallationId: projected.externalInstallationId,
      ownerIdentity: projected.ownerIdentity,
      authConfigId:
        projected.pinnedProviderAuthConfig?.currentVersion?.slateAuthConfig?.id ?? null,
      generation: projected.generation,
      status: 'tombstoned',
      correlationId: projected.correlationId,
      expiresAt: projected.expiresAt
    });
    return tombstoned;
  }
}

export let provisionedTenantAppService = Service.create(
  'provisionedTenantApp',
  () => new provisionedTenantAppServiceImpl()
).build();
