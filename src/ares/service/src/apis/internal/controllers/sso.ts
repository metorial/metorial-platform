import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { env } from '../../../env';
import { adminService } from '../../../services/admin';
import { ssoConnectionService } from '../../../services/sso/connection';
import { ssoSetupService } from '../../../services/sso/setup';
import { ssoTenantService } from '../../../services/sso/tenant';
import { internalApp } from '../_app';
import { ssoConnectionPresenter, ssoTenantPresenter } from '../presenters';

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
      let paginator = await ssoTenantService.listTenants({ app });
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
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.id });
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
      let tenant = await ssoTenantService.createTenant({
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
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.tenantId });
      let updatedTenant = await ssoTenantService.updateTenant({
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
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.tenantId });
      let setup = await ssoSetupService.createSetup({
        tenant,
        input: { redirectUri: input.redirectUri }
      });

      return {
        setupUrl: `${env.service.ARES_SSO_URL}/sso/setup?clientSecret=${setup.clientSecret}`
      };
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
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.tenantId });
      let paginator = await ssoConnectionService.listConnections({ tenant });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, ssoConnectionPresenter);
    })
});
