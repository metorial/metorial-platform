import { v } from '@lowerdeck/validation';
import {
  magicMcpEndpointBackingService,
  magicMcpServerBackingService,
  providerTemplateBackingService
} from '@metorial-subspace/module-integration';
import {
  magicMcpEndpointBackingPresenter,
  magicMcpServerBackingPresenter,
  providerTemplateBackingPresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

let backingProviderValidator = v.object({
  providerDeploymentId: v.string(),
  providerConfigId: v.optional(v.nullable(v.string())),
  providerAuthConfigId: v.optional(v.nullable(v.string())),
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
        providerDeploymentId: v.string(),
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
        magicMcpServerBackingId: v.string(),
        providerTemplateBackingId: v.optional(v.nullable(v.string())),
        ownerIntegrationId: v.optional(v.nullable(v.string())),
        name: v.optional(v.nullable(v.string())),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        privateMetadata: v.optional(v.nullable(v.record(v.any()))),
        maxSessionDurationInMinutes: v.number({ modifiers: [v.integer(), v.positive()] }),
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
          identityActorId: ctx.input.actorId,
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          maxSessionDurationInMinutes: ctx.input.maxSessionDurationInMinutes,
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
        magicMcpEndpointBackingId: v.string(),
        name: v.optional(v.nullable(v.string())),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        privateMetadata: v.optional(v.nullable(v.record(v.any()))),
        maxSessionDurationInMinutes: v.number({ modifiers: [v.integer(), v.positive()] }),
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
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          maxSessionDurationInMinutes: ctx.input.maxSessionDurationInMinutes,
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
    })
});
