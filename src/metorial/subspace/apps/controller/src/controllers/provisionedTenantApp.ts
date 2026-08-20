import { v } from '@lowerdeck/validation';
import {
  assertSlackManagerAppProvisioningEnabled,
  provisionedTenantAppService
} from '@metorial-subspace/module-auth';
import { app } from './_app';

let presentRouteMutation = (result: {
  route: {
    id: string;
    routeIdentifier: string;
    generation: number;
    status: string;
    projectionDigest: string;
  };
  outboxId: string;
}) => ({
  route: {
    id: result.route.id,
    routeIdentifier: result.route.routeIdentifier,
    generation: result.route.generation,
    status: result.route.status,
    projectionDigest: result.route.projectionDigest
  },
  outboxId: result.outboxId
});

let presentBindingMutation = (result: {
  binding: {
    id: string;
    generation: number;
    status: string;
    projectionDigest: string;
    externalAppId: string | null;
    externalAccountId: string | null;
    externalInstallationId: string | null;
  };
  outboxId: string;
}) => ({
  binding: {
    id: result.binding.id,
    generation: result.binding.generation,
    status: result.binding.status,
    projectionDigest: result.binding.projectionDigest,
    externalAppId: result.binding.externalAppId,
    externalAccountId: result.binding.externalAccountId,
    externalInstallationId: result.binding.externalInstallationId
  },
  outboxId: result.outboxId
});

export let provisionedTenantAppController = app.controller({
  createRoute: app
    .handler()
    .input(
      v.object({
        vendor: v.string(),
        purpose: v.literal('shared_provisioned_app'),
        credentialOwnerRef: v.string(),
        routeSecretId: v.string(),
        routeSecretVersion: v.number(),
        vendorVerificationSecretId: v.string(),
        vendorVerificationVersion: v.number(),
        expiresAt: v.optional(v.date())
      })
    )
    .do(async ctx =>
      presentRouteMutation(
        await provisionedTenantAppService.createProvisionedVendorAppRoute({
          input: ctx.input
        })
      )
    ),

  activateRoute: app
    .handler()
    .input(
      v.object({
        provisionedRouteId: v.string(),
        expectedGeneration: v.number(),
        routeSecretId: v.string(),
        routeSecretVersion: v.number(),
        vendorVerificationSecretId: v.string(),
        vendorVerificationVersion: v.number()
      })
    )
    .do(async ctx =>
      presentRouteMutation(
        await provisionedTenantAppService.activateProvisionedVendorAppRoute(ctx.input)
      )
    ),

  createBinding: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackInstanceId: v.string(),
        provisionedRouteId: v.string(),
        expectedRouteGeneration: v.number(),
        hubReceiverId: v.string(),
        hubReceiverGeneration: v.number(),
        hubReceiverTriggerId: v.string(),
        triggerActionId: v.string(),
        triggerSpecHash: v.string(),
        credentialOwnerType: v.enumOf(['managed', 'byo']),
        managedProviderAuthCredentialsId: v.optional(v.string()),
        credentialOwnerRef: v.string(),
        credentialSecretValue: v.optional(v.string()),
        expiresAt: v.optional(v.date())
      })
    )
    .do(async ctx =>
      presentBindingMutation(
        await provisionedTenantAppService.createProvisionedTenantApp({
          solution: ctx.solution,
          input: ctx.input
        })
      )
    ),

  createOrRotateCredentialSecret: app
    .handler()
    .input(
      v.object({
        provisionedTenantAppId: v.string(),
        expectedGeneration: v.number(),
        importedValue: v.string()
      })
    )
    .do(async ctx => {
      let result =
        await provisionedTenantAppService.createOrRotateProvisionedTenantCredentialSecret({
          solution: ctx.solution,
          ...ctx.input
        });
      return {
        ...presentBindingMutation(result),
        secret: result.secret,
        auditCorrelationId: result.auditCorrelationId,
        idempotent: result.idempotent,
        secretIssuanceReceipt: null
      };
    }),

  revokeCredentialSecret: app
    .handler()
    .input(
      v.object({
        provisionedTenantAppId: v.string(),
        expectedGeneration: v.number()
      })
    )
    .do(async ctx => {
      let result = await provisionedTenantAppService.revokeProvisionedTenantCredentialSecret({
        solution: ctx.solution,
        ...ctx.input
      });
      return {
        ...presentBindingMutation(result),
        secret: result.secret,
        auditCorrelationId: result.auditCorrelationId,
        idempotent: result.idempotent,
        secretIssuanceReceipt: null
      };
    }),

  activateBinding: app
    .handler()
    .input(
      v.object({
        provisionedTenantAppId: v.string(),
        expectedGeneration: v.number(),
        ownershipProof: v.record(v.any())
      })
    )
    .do(async ctx =>
      presentBindingMutation(
        await provisionedTenantAppService.activateProvisionedTenantApp(ctx.input)
      )
    ),

  beginGithubManifest: app
    .handler()
    .input(
      v.object({
        provisionedTenantAppId: v.string(),
        expectedGeneration: v.number()
      })
    )
    .do(async ctx => await provisionedTenantAppService.beginGithubManifest(ctx.input)),

  completeGithubManifest: app
    .handler()
    .input(
      v.object({
        provisionedTenantAppId: v.string(),
        expectedGeneration: v.number(),
        state: v.string(),
        code: v.string()
      })
    )
    .do(async ctx =>
      presentBindingMutation(
        await provisionedTenantAppService.completeGithubManifest(ctx.input)
      )
    ),

  completeGithubInstallation: app
    .handler()
    .input(
      v.object({
        provisionedTenantAppId: v.string(),
        expectedGeneration: v.number(),
        installationCode: v.string()
      })
    )
    .do(async ctx =>
      presentBindingMutation(
        await provisionedTenantAppService.completeGithubInstallation(ctx.input)
      )
    ),

  rebind: app
    .handler()
    .input(
      v.object({
        provisionedTenantAppId: v.string(),
        expectedGeneration: v.number(),
        expectedRouteGeneration: v.number(),
        callbackInstanceId: v.string(),
        hubReceiverId: v.string(),
        hubReceiverGeneration: v.number(),
        hubReceiverTriggerId: v.string(),
        triggerActionId: v.string(),
        triggerSpecHash: v.string()
      })
    )
    .do(async ctx => {
      let result = await provisionedTenantAppService.rebindProvisionedTenantApp({
        provisionedTenantAppId: ctx.input.provisionedTenantAppId,
        expectedGeneration: ctx.input.expectedGeneration,
        expectedRouteGeneration: ctx.input.expectedRouteGeneration,
        input: {
          callbackInstanceId: ctx.input.callbackInstanceId,
          hubReceiverId: ctx.input.hubReceiverId,
          hubReceiverGeneration: ctx.input.hubReceiverGeneration,
          hubReceiverTriggerId: ctx.input.hubReceiverTriggerId,
          triggerActionId: ctx.input.triggerActionId,
          triggerSpecHash: ctx.input.triggerSpecHash
        }
      });
      return {
        ...presentBindingMutation(result),
        tombstoneOutboxId: result.tombstoneOutboxId
      };
    }),

  tombstoneBinding: app
    .handler()
    .input(
      v.object({
        provisionedTenantAppId: v.string(),
        expectedGeneration: v.number()
      })
    )
    .do(async ctx =>
      presentBindingMutation(
        await provisionedTenantAppService.tombstoneProvisionedTenantApp(ctx.input)
      )
    ),

  tombstoneRoute: app
    .handler()
    .input(
      v.object({
        provisionedRouteId: v.string(),
        expectedGeneration: v.number()
      })
    )
    .do(async ctx =>
      presentRouteMutation(
        await provisionedTenantAppService.tombstoneProvisionedVendorAppRoute(ctx.input)
      )
    ),

  assertSlackManagerAppCapability: app
    .handler()
    .input(v.object({}))
    .do(async () => {
      assertSlackManagerAppProvisioningEnabled();
      return { enabled: true as const };
    })
});
