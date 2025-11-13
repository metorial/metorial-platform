import { v } from '@metorial/validation';
import { connectionPresenter } from '../../presenters/connection';
import { setupPresenter } from '../../presenters/setup';
import { tenantPresenter } from '../../presenters/tenant';
import { connectionService } from '../../services/connection';
import { setupService } from '../../services/setup';
import { tenantService } from '../../services/tenant';
import { internalApp } from '../_app';

export let tenantController = internalApp.controller({
  createTenant: internalApp
    .handler()
    .input(
      v.object({
        name: v.string(),
        metadata: v.record(v.any()),
        externalId: v.string()
      })
    )
    .do(async ctx => {
      let tenant = await tenantService.createTenant({
        input: {
          name: ctx.input.name,
          metadata: ctx.input.metadata,
          externalId: ctx.input.externalId
        }
      });

      return tenantPresenter(tenant);
    }),

  getTenant: internalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string()
      })
    )
    .do(async ctx => {
      let tenant = await tenantService.getTenantById({ tenantId: ctx.input.tenantId });
      return tenantPresenter(tenant);
    }),

  listConnections: internalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string()
      })
    )
    .do(async ctx => {
      let tenant = await tenantService.getTenantById({ tenantId: ctx.input.tenantId });

      let setups = await connectionService.listConnections({
        tenant
      });

      return setups.map(connection => connectionPresenter(connection));
    }),

  getConnection: internalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        connectionId: v.string()
      })
    )
    .do(async ctx => {
      let tenant = await tenantService.getTenantById({ tenantId: ctx.input.tenantId });

      let connection = await connectionService.getConnectionById({
        tenant,
        connectionId: ctx.input.connectionId
      });

      return connectionPresenter(connection);
    }),

  createSetup: internalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        redirectUri: v.string({ modifiers: [v.url()] })
      })
    )
    .do(async ctx => {
      let tenant = await tenantService.getTenantById({ tenantId: ctx.input.tenantId });

      let setup = await setupService.createSetup({
        tenant,
        input: {
          redirectUri: ctx.input.redirectUri
        }
      });

      return setupPresenter(setup);
    })
});
