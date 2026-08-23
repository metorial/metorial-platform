import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { adminService } from '../../../../services/admin';
import { ssoDelegationService } from '../../../../services/sso/delegation';
import { ssoDelegationClient } from '../../../../services/sso/delegationClient';
import { ssoTenantService } from '../../../../services/sso/tenant';
import { internalApp } from '../../_app';
import {
  delegationPresenter,
  importedDelegationPresenter
} from '../../presenters';

let descriptorValidation = v.object({
  id: v.string(),
  tenantId: v.string(),
  clientId: v.string(),
  clientSecret: v.string(),
  instance: v.object({
    id: v.string(),
    authorizationUrl: v.string(),
    tokenUrl: v.string()
  })
});

export let ssoDelegationsController = internalApp.controller({
  create: internalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        identifier: v.string()
      })
    )
    .do(async ({ input }) => {
      let tenant = await ssoTenantService.getTenantById({
        tenantId: input.tenantId
      });
      let delegation = await ssoDelegationService.createExport({
        tenant,
        identifier: input.identifier
      });
      return ssoDelegationService.presentDescriptor(delegation);
    }),

  store: internalApp
    .handler()
    .input(
      v.object({
        appId: v.string(),
        delegation: descriptorValidation
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let localInstance = await ssoDelegationService.ensureLocalInstance();
      let snapshot = await ssoDelegationClient.getMetadataFromDescriptor(
        input.delegation,
        { isSelfDelegation: localInstance.id === input.delegation.instance.id }
      );
      let imported = await ssoDelegationService.storeImport({
        app,
        descriptor: input.delegation,
        snapshot
      });
      return importedDelegationPresenter(imported);
    }),

  list: internalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          directions: v.optional(
            v.array(v.enumOf(['imported', 'exported']))
          ),
          appId: v.optional(v.string()),
          tenantId: v.optional(v.string()),
          clientId: v.optional(v.string()),
          instanceId: v.optional(v.string()),
          identifier: v.optional(v.string()),
          statuses: v.optional(v.array(v.enumOf(['active', 'disabled'])))
        })
      )
    )
    .do(async ({ input }) => {
      let all = await ssoDelegationService.listDelegations(input);
      let order = input.order ?? 'asc';
      if (order === 'desc') all.reverse();
      let limit = input.limit ?? 20;
      let start = 0;
      let end = Math.min(limit, all.length);
      if (input.after) {
        start = all.findIndex(item =>
          order === 'asc'
            ? item.delegation.id > input.after!
            : item.delegation.id < input.after!
        );
        if (start < 0) start = all.length;
        end = Math.min(start + limit, all.length);
      } else if (input.before) {
        end = all.findIndex(item =>
          order === 'asc'
            ? item.delegation.id >= input.before!
            : item.delegation.id <= input.before!
        );
        if (end < 0) end = all.length;
        start = Math.max(0, end - limit);
      }
      let items = all.slice(start, end);
      return {
        object: 'list' as const,
        items: items.map(delegationPresenter),
        pagination: {
          has_more_after: end < all.length,
          has_more_before: start > 0
        }
      };
    }),

  get: internalApp
    .handler()
    .input(v.object({ delegationId: v.string() }))
    .do(async ({ input }) =>
      delegationPresenter(
        await ssoDelegationService.getDelegation({
          delegationId: input.delegationId
        })
      )
    ),

  delete: internalApp
    .handler()
    .input(v.object({ delegationId: v.string() }))
    .do(async ({ input }) =>
      await ssoDelegationService.deleteDelegation({
        delegationId: input.delegationId
      })
    )
});
