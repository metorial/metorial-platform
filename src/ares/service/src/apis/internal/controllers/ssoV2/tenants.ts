import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { env } from '../../../../env';
import { getInitialSsoTenantEnrollment } from '../../../../lib/accountPolicy';
import { adminService } from '../../../../services/admin';
import { ssoSetupService } from '../../../../services/sso/setup';
import { ssoTenantService } from '../../../../services/sso/tenant';
import { internalApp } from '../../_app';
import { ssoTenantPresenter } from '../../presenters';
import { tenantApp } from './_middleware';

export let ssoTenantsController = internalApp.controller({
  list: internalApp
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

  create: internalApp
    .handler()
    .input(
      v.object({
        appId: v.string(),
        name: v.string(),
        enrollment: v.enumOf(['app', 'account']),
        externalId: v.optional(v.string()),
        hideInUI: v.optional(v.boolean()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let tenant = await ssoTenantService.createTenant({
        app,
        input: {
          name: input.name,
          externalId: input.externalId,
          hideInUI: input.hideInUI,
          metadata: input.metadata,
          enrollment: getInitialSsoTenantEnrollment(input.enrollment)
        }
      });
      return ssoTenantPresenter(tenant);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string()
      })
    )
    .do(async ({ tenant }) => {
      return ssoTenantPresenter(tenant);
    }),

  update: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.optional(v.string()),
        externalId: v.optional(v.string()),
        hideInUI: v.optional(v.boolean()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ({ input, tenant }) => {
      let updated = await ssoTenantService.updateTenant({
        tenant,
        input: {
          name: input.name,
          externalId: input.externalId,
          hideInUI: input.hideInUI,
          metadata: input.metadata
        }
      });
      return ssoTenantPresenter(updated);
    }),

  createSetup: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        redirectUri: v.string()
      })
    )
    .do(async ({ input, tenant }) => {
      let setup = await ssoSetupService.createSetup({
        tenant,
        input: {
          redirectUri: input.redirectUri
        }
      });

      return {
        object: 'ares#ssoSetup' as const,
        id: setup.id,
        setupUrl: `${env.service.ARES_SSO_URL}/sso/setup?clientSecret=${setup.clientSecret}`,
        redirectUri: setup.redirectUri,
        createdAt: setup.createdAt,
        updatedAt: setup.updatedAt
      };
    })
});
