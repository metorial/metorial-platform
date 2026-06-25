import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { identityActorService, identityService } from '@metorial-subspace/module-identity';
import { identityPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

let identityCredentialInputValidator = v.object({
  deploymentId: v.optional(v.string()),
  configId: v.optional(v.string()),
  authConfigId: v.optional(v.string()),
  delegationConfigId: v.optional(v.string())
});

export let identityApp = tenantApp.use(async ctx => {
  let identityId = ctx.body.identityId;
  if (!identityId) throw new Error('Identity ID is required');

  let identity = await identityService.getIdentityById({
    identityId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { identity };
});

export let identityController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),

          status: v.optional(v.array(v.enumOf(['active', 'archived', 'deleted']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          agentIds: v.optional(v.array(v.string())),
          actorIds: v.optional(v.array(v.string())),
          identityIds: v.optional(v.array(v.string())),
          identityCredentialIds: v.optional(v.array(v.string())),
          integrationIds: v.optional(v.array(v.string())),
          integrationInstanceIds: v.optional(v.array(v.string())),
          integrationInstanceProviderIds: v.optional(v.array(v.string())),
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
      let paginator = await identityService.listIdentities({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        agentIds: ctx.input.agentIds,
        actorIds: ctx.input.actorIds,
        identityIds: ctx.input.identityIds,
        identityCredentialIds: ctx.input.identityCredentialIds,
        integrationIds: ctx.input.integrationIds,
        integrationInstanceIds: ctx.input.integrationInstanceIds,
        integrationInstanceProviderIds: ctx.input.integrationInstanceProviderIds,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, identityPresenter);
    }),

  get: identityApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => identityPresenter(ctx.identity)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        identityActorId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any())),

        inputs: v.array(identityCredentialInputValidator)
      })
    )
    .do(async ctx => {
      let actor = await identityActorService.getIdentityActorById({
        identityActorId: ctx.input.identityActorId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let identity = await identityService.createIdentity({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        actor,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          inputs: ctx.input.inputs
        }
      });

      return identityPresenter(identity);
    }),

  update: identityApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let identity = await identityService.updateIdentity({
        identity: ctx.identity,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return identityPresenter(identity);
    }),

  delete: identityApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let identity = await identityService.archiveIdentity({
        identity: ctx.identity,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      return identityPresenter(identity);
    })
});
