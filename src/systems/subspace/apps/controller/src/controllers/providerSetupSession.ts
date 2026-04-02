import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  providerAuthCredentialsService,
  providerSetupSessionService
} from '@metorial-subspace/module-auth';
import { providerService } from '@metorial-subspace/module-catalog';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { identityService } from '@metorial-subspace/module-identity';
import { brandService } from '@metorial-subspace/module-tenant';
import { providerSetupSessionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let providerSetupSessionApp = tenantApp.use(async ctx => {
  let providerSetupSessionId = ctx.body.providerSetupSessionId;
  if (!providerSetupSessionId) throw new Error('ProviderSetupSession ID is required');

  let providerSetupSession = await providerSetupSessionService.getProviderSetupSessionById({
    providerSetupSessionId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { providerSetupSession };
});

export let providerSetupSessionController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(
            v.array(v.enumOf(['archived', 'failed', 'completed', 'expired', 'pending']))
          ),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerAuthMethodIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string())),
          providerAuthCredentialsIds: v.optional(v.array(v.string())),
          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerSetupSessionService.listProviderSetupSessions({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerAuthMethodIds: ctx.input.providerAuthMethodIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,
        providerAuthCredentialsIds: ctx.input.providerAuthCredentialsIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerSetupSessionPresenter);
    }),

  get: providerSetupSessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerSetupSessionId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => providerSetupSessionPresenter(ctx.providerSetupSession)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        ip: v.string(),
        ua: v.string(),

        providerId: v.optional(v.string()),
        providerAuthCredentialsId: v.optional(v.string()),
        providerDeploymentId: v.optional(v.string()),
        identityId: v.optional(v.string()),
        brandId: v.optional(v.string()),

        providerAuthMethodId: v.optional(v.string()),
        redirectUrl: v.optional(v.string()),

        authConfigInput: v.optional(v.record(v.any())),
        configInput: v.optional(v.record(v.any())),
        configuration: v.optional(
          v.object({
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
          })
        ),

        type: v.enumOf(['auth_and_config', 'auth_only', 'config_only']),
        uiMode: v.enumOf(['metorial_elements', 'dashboard_embeddable'])
      })
    )
    .do(async ctx => {
      let provider = ctx.input.providerId
        ? await providerService.getProviderById({
            providerId: ctx.input.providerId,
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution
          })
        : undefined;

      let providerDeployment = ctx.input.providerDeploymentId
        ? await providerDeploymentService.getProviderDeploymentById({
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution,
            providerDeploymentId: ctx.input.providerDeploymentId
          })
        : undefined;

      let credentials = ctx.input.providerAuthCredentialsId
        ? await providerAuthCredentialsService.getProviderAuthCredentialsById({
            providerAuthCredentialsId: ctx.input.providerAuthCredentialsId,
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution
          })
        : undefined;

      let identity = ctx.input.identityId
        ? await identityService.getIdentityById({
            identityId: ctx.input.identityId,
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution
          })
        : undefined;

      let brand = ctx.input.brandId
        ? await brandService.getBrandById({ id: ctx.input.brandId })
        : undefined;

      let providerSetupSession = await providerSetupSessionService.createProviderSetupSession({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        provider,
        providerDeployment,
        identity,
        credentials,
        brand,

        import: {
          ip: ctx.input.ip,
          ua: ctx.input.ua
        },

        input: {
          authMethodId: ctx.input.providerAuthMethodId,

          type: ctx.input.type,
          uiMode: ctx.input.uiMode,

          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          redirectUrl: ctx.input.redirectUrl,
          configuration: ctx.input.configuration as any,

          authConfigInput: ctx.input.authConfigInput,
          configInput: ctx.input.configInput
        }
      });

      return providerSetupSessionPresenter(providerSetupSession);
    }),

  update: providerSetupSessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerSetupSessionId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        identityId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let identity = ctx.input.identityId
        ? await identityService.getIdentityById({
            identityId: ctx.input.identityId,
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution
          })
        : undefined;

      let providerSetupSession = await providerSetupSessionService.updateProviderSetupSession({
        providerSetupSession: ctx.providerSetupSession,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          identity
        }
      });

      return providerSetupSessionPresenter(providerSetupSession);
    })
});
