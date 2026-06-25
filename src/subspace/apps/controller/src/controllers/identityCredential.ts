import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  identityCredentialService,
  identityDelegationConfigService,
  identityService
} from '@metorial-subspace/module-identity';
import { identityCredentialPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let identityCredentialApp = tenantApp.use(async ctx => {
  let identityCredentialId = ctx.body.identityCredentialId;
  if (!identityCredentialId) throw new Error('IdentityCredential ID is required');

  let identityCredential = await identityCredentialService.getIdentityCredentialById({
    identityCredentialId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { identityCredential };
});

export let identityCredentialController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(v.array(v.enumOf(['active', 'archived', 'deleted']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          agentIds: v.optional(v.array(v.string())),
          actorIds: v.optional(v.array(v.string())),
          identityIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await identityCredentialService.listIdentityCredentials({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        agentIds: ctx.input.agentIds,
        actorIds: ctx.input.actorIds,
        identityIds: ctx.input.identityIds,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, identityCredentialPresenter);
    }),

  get: identityCredentialApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityCredentialId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => identityCredentialPresenter(ctx.identityCredential)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        identityId: v.string(),

        deploymentId: v.optional(v.string()),
        configId: v.optional(v.string()),
        authConfigId: v.optional(v.string()),
        delegationConfigId: v.optional(v.string()),

        privateMetadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let identity = await identityService.getIdentityById({
        identityId: ctx.input.identityId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let identityCredential = await identityCredentialService.createIdentityCredential({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        identity,
        input: {
          deploymentId: ctx.input.deploymentId,
          configId: ctx.input.configId,
          authConfigId: ctx.input.authConfigId,
          delegationConfigId: ctx.input.delegationConfigId,
          privateMetadata: ctx.input.privateMetadata
        }
      });

      return identityCredentialPresenter(identityCredential);
    }),

  update: identityCredentialApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityCredentialId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        delegationConfigId: v.string()
      })
    )
    .do(async ctx => {
      let delegationConfig =
        await identityDelegationConfigService.getIdentityDelegationConfigById({
          identityDelegationConfigId: ctx.input.delegationConfigId,
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution
        });

      let identityCredential = await identityCredentialService.updateIdentityCredential({
        identityCredential: ctx.identityCredential,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        input: {
          delegationConfig
        }
      });

      return identityCredentialPresenter(identityCredential);
    }),

  delete: identityCredentialApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityCredentialId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let identityCredential = await identityCredentialService.archiveIdentityCredential({
        identityCredential: ctx.identityCredential,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      return identityCredentialPresenter(identityCredential);
    })
});
