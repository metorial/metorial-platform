import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { env } from '../../../env';
import { adminService } from '../../../services/admin';
import { ssoService } from '../../../services/sso';
import { adminApp } from '../middleware/admin';
import { ssoConnectionPresenter, ssoTenantPresenter } from '../presenters';

export let ssoController = adminApp.controller({
  listTenants: adminApp
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

  getTenant: adminApp
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

  createTenant: adminApp
    .handler()
    .input(
      v.object({
        appId: v.string(),
        name: v.string()
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let tenant = await ssoService.createTenant({
        app,
        input: { name: input.name }
      });
      return ssoTenantPresenter({ ...tenant, _count: { connections: 0 } });
    }),

  createSetup: adminApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        appId: v.string()
      })
    )
    .do(async ({ input }) => {
      let tenant = await ssoService.getTenantById({ tenantId: input.tenantId });
      let setup = await ssoService.createSetup({
        tenant,
        input: {
          redirectUri: `${env.service.ARES_ADMIN_URL}/apps/${input.appId}?sso_setup_complete=1`
        }
      });

      return {
        setupUrl: `${env.service.ARES_SSO_URL}/sso/setup?clientSecret=${setup.clientSecret}`
      };
    }),

  listConnections: adminApp
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
    }),

  listGlobalTenants: adminApp
    .handler()
    .input(Paginator.validate())
    .do(async ({ input }) => {
      let paginator = await ssoService.listGlobalTenants();
      let list = await paginator.run(input);
      return Paginator.presentLight(list, t => ({
        ...ssoTenantPresenter(t),
        app: { id: t.app.id, clientId: t.app.clientId }
      }));
    }),

  setGlobal: adminApp
    .handler()
    .input(
      v.object({
        id: v.string(),
        isGlobal: v.boolean()
      })
    )
    .do(async ({ input }) => {
      let tenant = await ssoService.getTenantById({ tenantId: input.id });
      let updated = await ssoService.setGlobal({ tenant, isGlobal: input.isGlobal });
      return ssoTenantPresenter(updated);
    })
});
