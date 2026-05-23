import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import {
  providerListingGroupService,
  providerListingService
} from '@metorial-subspace/module-catalog';
import { providerListingGroupPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let providerListingGroupApp = tenantApp.use(async ctx => {
  let providerListingGroupId = ctx.body.providerListingGroupId;
  if (!providerListingGroupId) throw new Error('ProviderListingGroup ID is required');

  let providerListingGroup = await providerListingGroupService.getProviderListingGroupById({
    providerListingGroupId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { providerListingGroup };
});

export let providerListingGroupController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerListingIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerListingGroupService.listProviderListingGroups({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerListingIds: ctx.input.providerListingIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerListingGroupPresenter);
    }),

  get: providerListingGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerListingGroupId: v.string()
      })
    )
    .do(async ctx => providerListingGroupPresenter(ctx.providerListingGroup)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        name: v.string(),
        description: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let providerListingGroup = await providerListingGroupService.createProviderListingGroup({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        input: {
          name: ctx.input.name,
          description: ctx.input.description
        }
      });

      return providerListingGroupPresenter(providerListingGroup);
    }),

  update: providerListingGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerListingGroupId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let providerListingGroup = await providerListingGroupService.updateProviderListingGroup({
        providerListingGroup: ctx.providerListingGroup,
        input: {
          name: ctx.input.name,
          description: ctx.input.description
        }
      });

      return providerListingGroupPresenter(providerListingGroup);
    }),

  delete: providerListingGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerListingGroupId: v.string()
      })
    )
    .do(async ctx => {
      await providerListingGroupService.deleteProviderListingGroup({
        providerListingGroup: ctx.providerListingGroup
      });

      return {};
    }),

  addProvider: providerListingGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerListingGroupId: v.string(),
        providerListingId: v.string()
      })
    )
    .do(async ctx => {
      let providerListing = await providerListingService.getProviderListingById({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        providerListingId: ctx.input.providerListingId
      });

      await providerListingGroupService.addProviderToGroup({
        providerListingGroup: ctx.providerListingGroup,
        providerListing
      });

      return {};
    }),

  removeProvider: providerListingGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerListingGroupId: v.string(),
        providerListingId: v.string()
      })
    )
    .do(async ctx => {
      let providerListing = await providerListingService.getProviderListingById({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        providerListingId: ctx.input.providerListingId
      });

      await providerListingGroupService.removeProviderFromGroup({
        providerListingGroup: ctx.providerListingGroup,
        providerListing
      });

      return {};
    })
});
