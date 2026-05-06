import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  magicMcpEndpointBackingService,
  magicMcpServerBackingService,
  magicMcpServerProviderService,
  providerTemplateBackingService
} from '@metorial-subspace/module-integration';
import { ephemeralManagedSessionService } from '@metorial-subspace/module-session';
import {
  magicMcpEndpointBackingPresenter,
  magicMcpServerBackingPresenter,
  magicMcpServerProviderPresenter,
  providerTemplateBackingPresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

let backingProviderValidator = v.object({
  providerDeploymentId: v.string(),
  providerConfigId: v.optional(v.nullable(v.string())),
  providerAuthConfigId: v.optional(v.nullable(v.string())),
  toolFilters: toolFiltersValidator
});

let providerTemplateBackingProviderValidator = v.object({
  providerId: v.string(),
  providerDeploymentId: v.optional(v.nullable(v.string())),
  providerAuthMethodId: v.optional(v.nullable(v.string())),
  providerAuthCredentialsId: v.optional(v.nullable(v.string())),
  providerConfigId: v.optional(v.nullable(v.string())),
  name: v.optional(v.string()),
  description: v.optional(v.nullable(v.string())),
  metadata: v.optional(v.nullable(v.record(v.any()))),
  toolFilters: toolFiltersValidator
});

let endpointServerValidator = v.object({
  id: v.string(),
  magicMcpServerBackingId: v.string(),
  toolFilters: toolFiltersValidator
});

export let magicMcpBackingController = app.controller({
  upsertProviderTemplate: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerTemplateId: v.string(),
        name: v.string(),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        privateMetadata: v.optional(v.nullable(v.record(v.any()))),
        providerDeploymentId: v.optional(v.nullable(v.string())),
        providers: v.optional(v.array(providerTemplateBackingProviderValidator)),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let backing = await providerTemplateBackingService.upsertProviderTemplateBacking({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        input: {
          providerTemplateId: ctx.input.providerTemplateId,
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          providerDeploymentId: ctx.input.providerDeploymentId,
          providers: ctx.input.providers?.map(provider => ({
            ...provider,
            ...(provider.toolFilters !== undefined
              ? { toolFilters: normalizeToolFilters(provider.toolFilters) as any }
              : {})
          })),
          ...(ctx.input.toolFilters !== undefined
            ? { toolFilters: normalizeToolFilters(ctx.input.toolFilters) }
            : {})
        }
      });

      return providerTemplateBackingPresenter(backing);
    }),

  reconcileProviderTemplate: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerTemplateId: v.string(),
        name: v.string(),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        privateMetadata: v.optional(v.nullable(v.record(v.any()))),
        providerDeploymentId: v.optional(v.nullable(v.string())),
        providers: v.optional(v.array(providerTemplateBackingProviderValidator)),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let backing = await providerTemplateBackingService.reconcileProviderTemplateBacking({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        input: {
          providerTemplateId: ctx.input.providerTemplateId,
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          providerDeploymentId: ctx.input.providerDeploymentId,
          providers: ctx.input.providers?.map(provider => ({
            ...provider,
            ...(provider.toolFilters !== undefined
              ? { toolFilters: normalizeToolFilters(provider.toolFilters) as any }
              : {})
          })),
          ...(ctx.input.toolFilters !== undefined
            ? { toolFilters: normalizeToolFilters(ctx.input.toolFilters) }
            : {})
        }
      });

      return providerTemplateBackingPresenter(backing);
    }),

  upsertServer: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.optional(v.nullable(v.string())),
        identityId: v.optional(v.nullable(v.string())),
        magicMcpServerBackingId: v.string(),
        providerTemplateBackingId: v.optional(v.nullable(v.string())),
        ownerIntegrationId: v.optional(v.nullable(v.string())),
        ownerIntegrationInstanceId: v.optional(v.nullable(v.string())),
        legacySessionTemplateId: v.optional(v.nullable(v.string())),
        name: v.optional(v.nullable(v.string())),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        privateMetadata: v.optional(v.nullable(v.record(v.any()))),
        maxSessionDurationInMinutes: v.number({ modifiers: [v.integer(), v.positive()] }),
        isReconciliation: v.optional(v.boolean()),
        providers: v.optional(v.array(backingProviderValidator))
      })
    )
    .do(async ctx => {
      let backing = await magicMcpServerBackingService.upsertMagicMcpServerBacking({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        input: {
          id: ctx.input.magicMcpServerBackingId,
          providerTemplateBackingId: ctx.input.providerTemplateBackingId,
          ownerIntegrationId: ctx.input.ownerIntegrationId,
          ownerIntegrationInstanceId: ctx.input.ownerIntegrationInstanceId,
          legacySessionTemplateId: ctx.input.legacySessionTemplateId,
          identityActorId: ctx.input.actorId,
          identityId: ctx.input.identityId,
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          maxSessionDurationInMinutes: ctx.input.maxSessionDurationInMinutes,
          isReconciliation: ctx.input.isReconciliation,
          providers: ctx.input.providers?.map(provider => ({
            providerDeploymentId: provider.providerDeploymentId,
            providerConfigId: provider.providerConfigId,
            providerAuthConfigId: provider.providerAuthConfigId,
            ...(provider.toolFilters !== undefined
              ? { toolFilters: normalizeToolFilters(provider.toolFilters) }
              : {})
          }))
        }
      });

      return magicMcpServerBackingPresenter(backing);
    }),

  upsertEndpoint: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.optional(v.nullable(v.string())),
        identityId: v.optional(v.nullable(v.string())),
        magicMcpEndpointBackingId: v.string(),
        name: v.optional(v.nullable(v.string())),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        privateMetadata: v.optional(v.nullable(v.record(v.any()))),
        maxSessionDurationInMinutes: v.number({ modifiers: [v.integer(), v.positive()] }),
        isReconciliation: v.optional(v.boolean()),
        servers: v.array(endpointServerValidator)
      })
    )
    .do(async ctx => {
      let backing = await magicMcpEndpointBackingService.upsertMagicMcpEndpointBacking({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        input: {
          id: ctx.input.magicMcpEndpointBackingId,
          identityActorId: ctx.input.actorId,
          identityId: ctx.input.identityId,
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          maxSessionDurationInMinutes: ctx.input.maxSessionDurationInMinutes,
          isReconciliation: ctx.input.isReconciliation,
          servers: ctx.input.servers.map(server => ({
            id: server.id,
            magicMcpServerBackingId: server.magicMcpServerBackingId,
            ...(server.toolFilters !== undefined
              ? { toolFilters: normalizeToolFilters(server.toolFilters) }
              : {})
          }))
        }
      });

      return magicMcpEndpointBackingPresenter(backing);
    }),

  getServer: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpServerBackingId: v.string()
      })
    )
    .do(async ctx => {
      let backing = await magicMcpServerBackingService.getMagicMcpServerBackingById({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        magicMcpServerBackingId: ctx.input.magicMcpServerBackingId
      });

      return magicMcpServerBackingPresenter(backing);
    }),

  listServerProviders: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          allowDeleted: v.optional(v.boolean()),
          status: v.optional(v.array(v.enumOf(['pending', 'active', 'archived', 'deleted']))),
          ids: v.optional(v.array(v.string())),
          magicMcpServerBackingIds: v.optional(v.array(v.string())),
          integrationProviderIds: v.optional(v.array(v.string())),
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
      let paginator = await magicMcpServerProviderService.listMagicMcpServerProviders({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        allowDeleted: ctx.input.allowDeleted,
        status: ctx.input.status,
        ids: ctx.input.ids,
        magicMcpServerBackingIds: ctx.input.magicMcpServerBackingIds,
        integrationProviderIds: ctx.input.integrationProviderIds,
        integrationInstanceProviderIds: ctx.input.integrationInstanceProviderIds,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });
      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, magicMcpServerProviderPresenter);
    }),

  getServerProvider: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpServerProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let provider = await magicMcpServerProviderService.getMagicMcpServerProviderById({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        magicMcpServerProviderId: ctx.input.magicMcpServerProviderId,
        allowDeleted: ctx.input.allowDeleted
      });
      return magicMcpServerProviderPresenter(provider);
    }),

  createServerProvider: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpServerBackingId: v.string(),
        providerId: v.string(),
        providerDeploymentId: v.optional(v.string()),
        providerConfigId: v.optional(v.nullable(v.string())),
        providerAuthConfigId: v.optional(v.nullable(v.string())),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let provider = await magicMcpServerProviderService.createMagicMcpServerProvider({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        magicMcpServerBackingId: ctx.input.magicMcpServerBackingId,
        input: {
          providerId: ctx.input.providerId,
          providerDeploymentId: ctx.input.providerDeploymentId,
          providerConfigId: ctx.input.providerConfigId,
          providerAuthConfigId: ctx.input.providerAuthConfigId,
          ...(ctx.input.toolFilters !== undefined
            ? { toolFilters: normalizeToolFilters(ctx.input.toolFilters) }
            : {})
        }
      });
      return magicMcpServerProviderPresenter(provider);
    }),

  updateServerProvider: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpServerProviderId: v.string(),
        providerDeploymentId: v.optional(v.string()),
        providerConfigId: v.optional(v.nullable(v.string())),
        providerAuthConfigId: v.optional(v.nullable(v.string())),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let provider = await magicMcpServerProviderService.updateMagicMcpServerProvider({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        magicMcpServerProviderId: ctx.input.magicMcpServerProviderId,
        input: {
          providerDeploymentId: ctx.input.providerDeploymentId,
          providerConfigId: ctx.input.providerConfigId,
          providerAuthConfigId: ctx.input.providerAuthConfigId,
          ...(ctx.input.toolFilters !== undefined
            ? { toolFilters: normalizeToolFilters(ctx.input.toolFilters) }
            : {})
        }
      });
      return magicMcpServerProviderPresenter(provider);
    }),

  archiveServerProvider: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpServerProviderId: v.string()
      })
    )
    .do(async ctx => {
      let provider = await magicMcpServerProviderService.archiveMagicMcpServerProvider({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        magicMcpServerProviderId: ctx.input.magicMcpServerProviderId
      });
      return magicMcpServerProviderPresenter(provider);
    }),

  getProviderTemplate: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerTemplateBackingId: v.string()
      })
    )
    .do(async ctx => {
      let backing = await providerTemplateBackingService.getProviderTemplateBackingById({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        providerTemplateBackingId: ctx.input.providerTemplateBackingId
      });

      return providerTemplateBackingPresenter(backing);
    }),

  getManyProviderTemplates: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerTemplateBackingIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let backings = await providerTemplateBackingService.getManyProviderTemplateBackingsByIds(
        {
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          providerTemplateBackingIds: ctx.input.providerTemplateBackingIds
        }
      );

      return backings.map(providerTemplateBackingPresenter);
    }),

  getManyProviderTemplatesByIntegrationIds: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let backings =
        await providerTemplateBackingService.getManyProviderTemplateBackingsByIntegrationIds({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          integrationIds: ctx.input.integrationIds
        });

      return backings.map(providerTemplateBackingPresenter);
    }),

  getServerSession: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpServerBackingId: v.string()
      })
    )
    .do(async ctx => {
      let backing = await magicMcpServerBackingService.getMagicMcpServerBackingById({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        magicMcpServerBackingId: ctx.input.magicMcpServerBackingId
      });

      let session = await ephemeralManagedSessionService.resolveBackingSessionById({
        sessionId: backing.ephemeralManagedSession.id,
        tenantId: ctx.tenant.id,
        solutionId: ctx.solution.id
      });
      if (!session) {
        throw new ServiceError(
          notFoundError(
            'session',
            backing.ephemeralManagedSession.currentSessionOid?.toString()
          )
        );
      }

      return {
        object: 'magic_mcp.server_backing.session',
        sessionId: session.id
      };
    }),

  getEndpoint: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpEndpointBackingId: v.string()
      })
    )
    .do(async ctx => {
      let backing = await magicMcpEndpointBackingService.getMagicMcpEndpointBackingById({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        magicMcpEndpointBackingId: ctx.input.magicMcpEndpointBackingId
      });

      return magicMcpEndpointBackingPresenter(backing);
    }),

  archiveServer: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpServerBackingId: v.string()
      })
    )
    .do(async ctx => {
      let backing = await magicMcpServerBackingService.archiveMagicMcpServerBacking({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        magicMcpServerBackingId: ctx.input.magicMcpServerBackingId
      });

      return magicMcpServerBackingPresenter(backing);
    }),

  archiveEndpoint: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpEndpointBackingId: v.string()
      })
    )
    .do(async ctx => {
      let backing = await magicMcpEndpointBackingService.archiveMagicMcpEndpointBacking({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        magicMcpEndpointBackingId: ctx.input.magicMcpEndpointBackingId
      });

      return magicMcpEndpointBackingPresenter(backing);
    }),

  archiveProviderTemplate: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerTemplateBackingId: v.string()
      })
    )
    .do(async ctx => {
      let backing = await providerTemplateBackingService.archiveProviderTemplateBacking({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        providerTemplateBackingId: ctx.input.providerTemplateBackingId
      });

      return providerTemplateBackingPresenter(backing);
    })
});
