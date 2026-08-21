import { v } from '@lowerdeck/validation';
import {
  getSlateProvisionedProjectionStateForTenant,
  projectSlateProvisionedAppRoute,
  projectSlateProvisionedTenantApp
} from '../../services/slateTriggerReceiverSecretProjection';
import { app } from './_app';
import { tenantApp } from './tenant';

let statusSchema = v.enumOf(['active', 'tombstoned'] as const);

let presentRoute = (route: Awaited<ReturnType<typeof projectSlateProvisionedAppRoute>>) => ({
  object: 'slate.provisioned_app_route_projection' as const,
  provisionedRouteId: route.provisionedRouteId,
  routeIdentifier: route.routeIdentifier,
  vendor: route.vendor,
  purpose: route.purpose,
  oauthCredentialsId: route.oauthCredentials?.id ?? null,
  authConfigId: route.authConfig?.id ?? null,
  generation: route.generation,
  status: route.status,
  projectionDigest: route.projectionDigest,
  correlationId: route.correlationId,
  expiresAt: route.expiresAt
});

let presentTenantApp = (
  binding: Awaited<ReturnType<typeof projectSlateProvisionedTenantApp>>
) => ({
  object: 'slate.provisioned_tenant_app_projection' as const,
  provisionedTenantAppId: binding.provisionedTenantAppId,
  provisionedRouteId: binding.routeProjection.provisionedRouteId,
  tenantId: binding.tenant.id,
  receiverId: binding.receiver.id,
  receiverTriggerId: binding.receiverTrigger.id,
  callbackInstanceId: binding.callbackInstanceId,
  hubReceiverGeneration: binding.hubReceiverGeneration,
  triggerActionId: binding.triggerActionId,
  triggerSpecHash: binding.triggerSpecHash,
  vendor: binding.vendor,
  externalAppId: binding.externalAppId,
  externalAccountId: binding.externalAccountId,
  externalInstallationId: binding.externalInstallationId,
  ownerIdentity: binding.ownerIdentity,
  authConfigId: binding.authConfig?.id ?? null,
  generation: binding.generation,
  status: binding.status,
  projectionDigest: binding.projectionDigest,
  correlationId: binding.correlationId,
  expiresAt: binding.expiresAt
});

export let provisionedAppProjectionController = app.controller({
  upsertRoute: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        provisionedRouteId: v.string(),
        routeIdentifier: v.string(),
        vendor: v.string(),
        purpose: v.literal('shared_provisioned_app'),
        oauthCredentialsId: v.optional(v.nullable(v.string())),
        authConfigId: v.optional(v.nullable(v.string())),
        generation: v.number({ modifiers: [v.integer(), v.positive()] }),
        status: statusSchema,
        correlationId: v.string(),
        expiresAt: v.optional(v.nullable(v.date()))
      })
    )
    .do(async ctx =>
      presentRoute(
        await projectSlateProvisionedAppRoute(
          {
            provisionedRouteId: ctx.input.provisionedRouteId,
            routeIdentifier: ctx.input.routeIdentifier,
            vendor: ctx.input.vendor,
            purpose: ctx.input.purpose,
            oauthCredentialsId: ctx.input.oauthCredentialsId,
            authConfigId: ctx.input.authConfigId,
            generation: ctx.input.generation,
            status: ctx.input.status,
            correlationId: ctx.input.correlationId,
            expiresAt: ctx.input.expiresAt
          },
          { expectedTenantOid: ctx.tenant.oid }
        )
      )
    ),

  upsertTenantApp: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        provisionedTenantAppId: v.string(),
        provisionedRouteId: v.string(),
        receiverId: v.string(),
        receiverTriggerId: v.string(),
        callbackInstanceId: v.string(),
        hubReceiverGeneration: v.number({ modifiers: [v.integer(), v.positive()] }),
        triggerActionId: v.string(),
        triggerSpecHash: v.string(),
        vendor: v.string(),
        externalAppId: v.optional(v.nullable(v.string())),
        externalAccountId: v.optional(v.nullable(v.string())),
        externalInstallationId: v.optional(v.nullable(v.string())),
        ownerIdentity: v.optional(v.nullable(v.string())),
        authConfigId: v.optional(v.nullable(v.string())),
        generation: v.number({ modifiers: [v.integer(), v.positive()] }),
        status: statusSchema,
        correlationId: v.string(),
        expiresAt: v.optional(v.nullable(v.date()))
      })
    )
    .do(async ctx =>
      presentTenantApp(
        await projectSlateProvisionedTenantApp({
          provisionedTenantAppId: ctx.input.provisionedTenantAppId,
          provisionedRouteId: ctx.input.provisionedRouteId,
          tenantId: ctx.tenant.id,
          receiverId: ctx.input.receiverId,
          receiverTriggerId: ctx.input.receiverTriggerId,
          callbackInstanceId: ctx.input.callbackInstanceId,
          hubReceiverGeneration: ctx.input.hubReceiverGeneration,
          triggerActionId: ctx.input.triggerActionId,
          triggerSpecHash: ctx.input.triggerSpecHash,
          vendor: ctx.input.vendor,
          externalAppId: ctx.input.externalAppId,
          externalAccountId: ctx.input.externalAccountId,
          externalInstallationId: ctx.input.externalInstallationId,
          ownerIdentity: ctx.input.ownerIdentity,
          authConfigId: ctx.input.authConfigId,
          generation: ctx.input.generation,
          status: ctx.input.status,
          correlationId: ctx.input.correlationId,
          expiresAt: ctx.input.expiresAt
        })
      )
    ),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        entityKind: v.enumOf(['route', 'tenant_app'] as const),
        entityId: v.string()
      })
    )
    .do(async ctx => {
      let projection = await getSlateProvisionedProjectionStateForTenant({
        tenant: ctx.tenant,
        entityKind: ctx.input.entityKind,
        entityId: ctx.input.entityId
      });

      return ctx.input.entityKind === 'route'
        ? presentRoute(
            projection as Awaited<ReturnType<typeof projectSlateProvisionedAppRoute>>
          )
        : presentTenantApp(
            projection as Awaited<ReturnType<typeof projectSlateProvisionedTenantApp>>
          );
    })
});
