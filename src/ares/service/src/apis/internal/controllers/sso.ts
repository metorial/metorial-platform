import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { env } from '../../../env';
import { adminService } from '../../../services/admin';
import { ssoService } from '../../../services/sso';
import { internalApp } from '../_app';
import {
  ssoConnectionPresenter,
  ssoTenantDomainPresenter,
  ssoTenantPresenter
} from '../presenters';

export let ssoController = internalApp.controller({
  listTenants: internalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          appId: v.string()
        })
      )
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let paginator = await ssoService.listTenants({ app });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, ssoTenantPresenter);
    }),

  getTenant: internalApp
    .handler()
    .input(
      v.object({
        id: v.string()
      })
    )
    .do(async ({ input }) => {
      let tenant = await ssoService.getTenantById({ tenantId: input.id });
      return ssoTenantPresenter(tenant);
    }),

  createTenant: internalApp
    .handler()
    .input(
      v.object({
        appId: v.string(),
        name: v.string(),
        externalId: v.optional(v.string()),
        hideInUI: v.optional(v.boolean())
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let tenant = await ssoService.createTenant({
        app,
        input: {
          name: input.name,
          externalId: input.externalId,
          hideInUI: input.hideInUI
        }
      });
      return ssoTenantPresenter(tenant);
    }),

  updateTenant: internalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.optional(v.string()),
        externalId: v.optional(v.string()),
        hideInUI: v.optional(v.boolean())
      })
    )
    .do(async ({ input }) => {
      let tenant = await ssoService.getTenantById({ tenantId: input.tenantId });
      let updatedTenant = await ssoService.updateTenant({
        tenant,
        input: {
          name: input.name,
          externalId: input.externalId,
          hideInUI: input.hideInUI
        }
      });
      return ssoTenantPresenter(updatedTenant);
    }),

  createSetup: internalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        redirectUri: v.string()
      })
    )
    .do(async ({ input }) => {
      let tenant = await ssoService.getTenantById({ tenantId: input.tenantId });
      let setup = await ssoService.createSetup({
        tenant,
        input: { redirectUri: input.redirectUri }
      });

      return {
        setupUrl: `${env.service.ARES_SSO_URL}/sso/setup?clientSecret=${setup.clientSecret}`
      };
    }),

  addDomain: internalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        domain: v.string()
      })
    )
    .do(async ({ input }) => {
      let tenant = await ssoService.getTenantById({ tenantId: input.tenantId });
      let tenantDomain = await ssoService.addTenantDomain({
        tenant,
        input: {
          domain: input.domain
        }
      });
      return ssoTenantDomainPresenter(tenantDomain);
    }),

  removeDomain: internalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        domain: v.string()
      })
    )
    .do(async ({ input }) => {
      let tenant = await ssoService.getTenantById({ tenantId: input.tenantId });
      await ssoService.removeTenantDomain({
        tenant,
        domain: input.domain
      });
      return { success: true };
    }),

  listConnections: internalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ({ input }) => {
      let tenant = await ssoService.getTenantById({ tenantId: input.tenantId });
      let paginator = await ssoService.listConnections({ tenant });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, ssoConnectionPresenter);
    })
});
