import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerService, providerVersionService } from '@metorial-subspace/module-catalog';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { normalizeToolFilters } from '@metorial-subspace/module-provider-internal';
import { providerDeploymentPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { configSourceValidator, resolveConfigSource } from './providerResourceValidators';
import { toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

export let providerDeploymentApp = tenantApp.use(async ctx => {
  let providerDeploymentId = ctx.body.providerDeploymentId;
  if (!providerDeploymentId) throw new Error('ProviderDeployment ID is required');

  let providerDeployment = await providerDeploymentService.getProviderDeploymentById({
    providerDeploymentId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { providerDeployment };
});

export let providerDeploymentController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),

          status: v.optional(v.array(v.enumOf(['active', 'archived']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerVersionIds: v.optional(v.array(v.string())),
          actorIds: v.optional(v.array(v.string())),
          identityIds: v.optional(v.array(v.string())),
          identityCredentialIds: v.optional(v.array(v.string())),

          capabilities: v.optional(
            v.object({
              supportsConfig: v.optional(v.boolean()),
              supportsAuth: v.optional(v.boolean()),
              supportsOAuth: v.optional(v.boolean()),
              supportsCallbacks: v.optional(v.boolean()),
              supportsOAuthAutoRegistration: v.optional(v.boolean()),
              supportsAuthExport: v.optional(v.boolean()),
              supportsAuthImport: v.optional(v.boolean())
            })
          ),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerDeploymentService.listProviderDeployments({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        capabilities: ctx.input.capabilities,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerVersionIds: ctx.input.providerVersionIds,
        actorIds: ctx.input.actorIds,
        identityIds: ctx.input.identityIds,
        identityCredentialIds: ctx.input.identityCredentialIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerDeploymentPresenter);
    }),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        ids: v.array(v.string()),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let providerDeployments = await providerDeploymentService.getManyProviderDeploymentsByIds({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        allowDeleted: ctx.input.allowDeleted
      });

      return providerDeployments.map(providerDeploymentPresenter);
    }),

  get: providerDeploymentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerDeploymentId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => providerDeploymentPresenter(ctx.providerDeployment)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any())),

        isEphemeral: v.optional(v.boolean()),

        providerId: v.string(),
        lockedProviderVersionId: v.optional(v.string()),

        config: v.optional(configSourceValidator),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let provider = await providerService.getProviderById({
        providerId: ctx.input.providerId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let lockedVersion = ctx.input.lockedProviderVersionId
        ? await providerVersionService.getProviderVersionById({
            providerVersionId: ctx.input.lockedProviderVersionId,
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution
          })
        : undefined;

      let providerDeployment = await providerDeploymentService.createProviderDeployment({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        provider,
        lockedVersion,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          toolFilters: normalizeToolFilters(ctx.input.toolFilters as any),

          isEphemeral: ctx.input.isEphemeral,

          config: await resolveConfigSource(
            { tenant: ctx.tenant, solution: ctx.solution, environment: ctx.environment },
            ctx.input.config
          )
        }
      });

      return providerDeploymentPresenter(providerDeployment);
    }),

  update: providerDeploymentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerDeploymentId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any())),
        toolFilters: toolFiltersValidator,
        lockedProviderVersionId: v.optional(v.nullable(v.string()))
      })
    )
    .do(async ctx => {
      if (
        ctx.input.lockedProviderVersionId !== undefined &&
        ctx.providerDeployment.isEphemeral
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot update locked version on ephemeral provider deployment',
            description:
              'Ephemeral provider deployments are short-lived and cannot have their locked version changed.'
          })
        );
      }

      let lockedVersion: Awaited<
        ReturnType<typeof providerVersionService.getProviderVersionById>
      > | null | undefined = undefined;

      if (ctx.input.lockedProviderVersionId !== undefined) {
        if (ctx.input.lockedProviderVersionId === null) {
          lockedVersion = null;
        } else {
          lockedVersion = await providerVersionService.getProviderVersionById({
            providerVersionId: ctx.input.lockedProviderVersionId,
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution
          });

          if (lockedVersion.providerOid !== ctx.providerDeployment.providerOid) {
            throw new ServiceError(
              badRequestError({
                message: 'Provider version does not belong to this deployment provider',
                description:
                  'The locked provider version must belong to the same provider as the deployment.'
              })
            );
          }
        }
      }

      let providerDeployment = await providerDeploymentService.updateProviderDeployment({
        providerDeployment: ctx.providerDeployment,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          ...(ctx.input.toolFilters !== undefined
            ? { toolFilters: normalizeToolFilters(ctx.input.toolFilters as any) }
            : {}),
          lockedVersion
        }
      });

      return providerDeploymentPresenter(providerDeployment);
    }),

  delete: providerDeploymentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerDeploymentId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let providerDeployment = await providerDeploymentService.archiveProviderDeployment({
        providerDeployment: ctx.providerDeployment,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      return providerDeploymentPresenter(providerDeployment);
    })
});
