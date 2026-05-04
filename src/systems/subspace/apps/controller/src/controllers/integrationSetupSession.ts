import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  integrationService,
  integrationSetupSessionService
} from '@metorial-subspace/module-integration';
import { brandService } from '@metorial-subspace/module-tenant';
import { integrationSetupSessionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let integrationSetupSessionApp = tenantApp.use(async ctx => {
  let integrationSetupSessionId = ctx.body.integrationSetupSessionId;
  if (!integrationSetupSessionId) throw new Error('IntegrationSetupSession ID is required');

  let integrationSetupSession =
    await integrationSetupSessionService.getIntegrationSetupSessionById({
      integrationSetupSessionId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution,
      allowDeleted: ctx.body.allowDeleted
    });

  return { integrationSetupSession };
});

let setupSessionConfigurationValidator = v.object({
  providerSearch: v.optional(
    v.object({
      groups: v.optional(v.array(v.object({ groupId: v.string() }))),
      collections: v.optional(v.array(v.object({ collectionId: v.string() }))),
      categories: v.optional(v.array(v.object({ categoryId: v.string() })))
    })
  ),
  toolFilters: v.optional(
    v.object({
      enabled: v.optional(v.boolean())
    })
  ),
  ui: v.optional(
    v.object({
      layout: v.optional(v.enumOf(['box', 'side', 'light']))
    })
  )
});

export let integrationSetupSessionController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(
            v.array(v.enumOf(['pending', 'successful', 'expired', 'archived', 'deleted']))
          ),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          integrationIds: v.optional(v.array(v.string())),
          integrationInstanceIds: v.optional(v.array(v.string())),
          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await integrationSetupSessionService.listIntegrationSetupSessions({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,
        ids: ctx.input.ids,
        integrationIds: ctx.input.integrationIds,
        integrationInstanceIds: ctx.input.integrationInstanceIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, integrationSetupSessionPresenter);
    }),

  get: integrationSetupSessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationSetupSessionId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => integrationSetupSessionPresenter(ctx.integrationSetupSession)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        integrationId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any())),
        identityActorId: v.optional(v.nullable(v.string())),
        identityId: v.optional(v.nullable(v.string())),
        brandId: v.optional(v.string()),
        expiresAt: v.optional(v.date()),
        redirectUrl: v.optional(v.string()),
        configuration: v.optional(setupSessionConfigurationValidator),

        ip: v.string(),
        ua: v.string()
      })
    )
    .do(async ctx => {
      let integration = await integrationService.getIntegrationById({
        integrationId: ctx.input.integrationId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });
      let brand = ctx.input.brandId
        ? await brandService.getBrandById({ id: ctx.input.brandId })
        : undefined;

      let integrationSetupSession =
        await integrationSetupSessionService.createIntegrationSetupSession({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          integration,
          brand,
          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            metadata: ctx.input.metadata,
            privateMetadata: ctx.input.privateMetadata,
            identityActorId: ctx.input.identityActorId,
            identityId: ctx.input.identityId,
            expiresAt: ctx.input.expiresAt,
            redirectUrl: ctx.input.redirectUrl,
            configuration: ctx.input.configuration as any
          },
          import: {
            ip: ctx.input.ip,
            ua: ctx.input.ua
          }
        });

      return integrationSetupSessionPresenter(integrationSetupSession);
    })
});
