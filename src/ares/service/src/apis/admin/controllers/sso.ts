import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { env } from '../../../env';
import { adminService } from '../../../services/admin';
import { ssoConnectionService } from '../../../services/sso/connection';
import { ssoDirectoryService } from '../../../services/sso/directory';
import { ssoSetupService } from '../../../services/sso/setup';
import { ssoTenantService } from '../../../services/sso/tenant';
import { adminApp } from '../middleware/admin';
import {
  ssoConnectionPresenter,
  ssoDirectoryPresenter,
  ssoTenantPresenter
} from '../presenters';

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
      let paginator = await ssoTenantService.listTenants({ app });
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
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.id });
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
      let tenant = await ssoTenantService.createTenant({
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
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.tenantId });
      let setup = await ssoSetupService.createSetup({
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
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.tenantId });
      let paginator = await ssoConnectionService.listConnections({ tenant });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, ssoConnectionPresenter);
    }),

  setConnectionStatus: adminApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        connectionId: v.string(),
        status: v.enumOf(['active', 'disabled'])
      })
    )
    .do(async ({ input }) => {
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.tenantId });
      let connection = await ssoConnectionService.getConnectionById({
        tenant,
        connectionId: input.connectionId
      });
      let updated = await ssoConnectionService.setConnectionStatus({
        tenant,
        connection,
        status: input.status
      });
      return ssoConnectionPresenter(updated);
    }),

  createDirectory: adminApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        connectionId: v.string(),
        name: v.string(),
        type: v.string(),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ({ input }) => {
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.tenantId });
      let connection = await ssoConnectionService.getConnectionById({
        tenant,
        connectionId: input.connectionId
      });
      let { directory, scim } = await ssoDirectoryService.createDirectory({
        tenant,
        connection,
        input: {
          name: input.name,
          type: input.type as any,
          metadata: input.metadata
        }
      });

      return {
        directory: ssoDirectoryPresenter(directory),
        scim
      };
    }),

  listDirectories: adminApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          connectionId: v.string()
        })
      )
    )
    .do(async ({ input }) => {
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.tenantId });
      let connection = await ssoConnectionService.getConnectionById({
        tenant,
        connectionId: input.connectionId
      });
      let paginator = await ssoDirectoryService.listDirectories({ connection });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, ssoDirectoryPresenter);
    }),

  getDirectory: adminApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        connectionId: v.string(),
        directoryId: v.string()
      })
    )
    .do(async ({ input }) => {
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.tenantId });
      let connection = await ssoConnectionService.getConnectionById({
        tenant,
        connectionId: input.connectionId
      });
      let directory = await ssoDirectoryService.getDirectoryById({
        tenant,
        connection,
        directoryId: input.directoryId
      });
      return ssoDirectoryPresenter(directory);
    }),

  setDirectoryStatus: adminApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        connectionId: v.string(),
        directoryId: v.string(),
        status: v.enumOf(['active', 'disabled'])
      })
    )
    .do(async ({ input }) => {
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.tenantId });
      let connection = await ssoConnectionService.getConnectionById({
        tenant,
        connectionId: input.connectionId
      });
      let directory = await ssoDirectoryService.getDirectoryById({
        tenant,
        connection,
        directoryId: input.directoryId
      });
      let updated = await ssoDirectoryService.setDirectoryStatus({
        tenant,
        connection,
        directory,
        status: input.status
      });
      return ssoDirectoryPresenter(updated);
    }),

  listGlobalTenants: adminApp
    .handler()
    .input(Paginator.validate())
    .do(async ({ input }) => {
      let paginator = await ssoTenantService.listGlobalTenants();
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
      let tenant = await ssoTenantService.getTenantById({ tenantId: input.id });
      let updated = await ssoTenantService.setGlobal({ tenant, isGlobal: input.isGlobal });
      return ssoTenantPresenter(updated);
    })
});
