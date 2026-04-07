import { badRequestError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerAresService } from '@metorial/module-consumer';
import { portalService } from '@metorial/module-portal';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { isDashboardGroup } from '../../middleware/isDashboard';
import {
  portalAuthAppPresenter,
  portalAuthSsoConnectionPresenter,
  portalAuthSsoTenantPresenter,
  portalAuthSsoTenantSetupPresenter
} from '../../presenters';
import { portalGroup } from './portal';

let getPortalAresAppId = (portal: {
  surface: {
    consumerAuthTenant: {
      aresAppId: string | null;
    } | null;
  };
}) => {
  let appId = portal.surface.consumerAuthTenant?.aresAppId;
  if (!appId) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'Portal auth is not configured for this portal.'
      })
    );
  }

  return appId;
};

let portalAuthManagementGroup = portalGroup
  .use(isDashboardGroup())
  .use(hasFlags(['paid-portals', 'paid-sso-tenants', 'portals-access']));

let portalAuthManagementSsoTenantGroup = portalAuthManagementGroup.use(async ctx => {
  if (!ctx.params.ssoTenantId) {
    throw new ServiceError(
      badRequestError({
        message: 'ssoTenantId is required',
        description: 'The ssoTenantId path parameter is required.'
      })
    );
  }

  let ssoTenant = await consumerAresService.getSsoTenantForApp({
    appId: getPortalAresAppId(ctx.portal),
    ssoTenantId: ctx.params.ssoTenantId
  });

  return { ssoTenant };
});

export let portalAuthDashboardController = Controller.create(
  {
    name: 'Portal Auth',
    description: 'Manage the Ares-backed authentication configuration for a portal.',
    hideInDocs: true
  },
  {
    getApp: portalAuthManagementGroup
      .get(instancePath('portals/:portalId/auth/app', 'portals.auth.app.get'), {
        name: 'Get portal auth app',
        description: 'Returns the Ares app configuration for a portal.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.auth:read'] }))
      .output(portalAuthAppPresenter)
      .do(async ctx => {
        return portalAuthAppPresenter.present({
          app: await consumerAresService.getApp({
            appId: getPortalAresAppId(ctx.portal)
          })
        });
      }),

    listSsoTenants: portalAuthManagementGroup
      .get(
        instancePath('portals/:portalId/auth/sso-tenants', 'portals.auth.ssoTenants.list'),
        {
          name: 'List portal auth SSO tenants',
          description: 'Returns the SSO tenants configured for a portal Ares app.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.auth:read'] }))
      .query('default', Paginator.validate(v.object({})))
      .outputList(portalAuthSsoTenantPresenter)
      .do(async ctx => {
        let list = await consumerAresService.listSsoTenants({
          appId: getPortalAresAppId(ctx.portal),
          limit: ctx.query.limit,
          after: ctx.query.after,
          before: ctx.query.before,
          cursor: ctx.query.cursor,
          order: ctx.query.order
        });

        return Paginator.present(list, ssoTenant =>
          portalAuthSsoTenantPresenter.present({ ssoTenant })
        );
      }),

    createSsoTenant: portalAuthManagementGroup
      .post(
        instancePath('portals/:portalId/auth/sso-tenants', 'portals.auth.ssoTenants.create'),
        {
          name: 'Create portal auth SSO tenant',
          description: 'Creates an SSO tenant for the portal Ares app.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.auth:write'] }))
      .body(
        'default',
        v.object({
          name: v.string()
        })
      )
      .output(portalAuthSsoTenantPresenter)
      .do(async ctx => {
        let ssoTenant = await consumerAresService.createSsoTenant({
          appId: getPortalAresAppId(ctx.portal),
          name: ctx.body.name
        });

        return portalAuthSsoTenantPresenter.present({ ssoTenant });
      }),

    createSsoTenantSetup: portalAuthManagementSsoTenantGroup
      .post(
        instancePath(
          'portals/:portalId/auth/sso-tenants/:ssoTenantId/setup',
          'portals.auth.ssoTenants.setup'
        ),
        {
          name: 'Create portal auth SSO tenant setup',
          description:
            'Creates an Ares setup URL for finishing portal SSO tenant configuration.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.auth:write'] }))
      .output(portalAuthSsoTenantSetupPresenter)
      .do(async ctx => {
        let ssoTenantSetup = await consumerAresService.createSsoTenantSetup({
          ssoTenantId: ctx.ssoTenant.id,
          redirectUrl: portalService.getPortalHost({ portal: ctx.portal }).host
        });

        return portalAuthSsoTenantSetupPresenter.present({ ssoTenantSetup });
      }),

    listSsoConnections: portalAuthManagementSsoTenantGroup
      .get(
        instancePath(
          'portals/:portalId/auth/sso-tenants/:ssoTenantId/connections',
          'portals.auth.ssoTenants.connections.list'
        ),
        {
          name: 'List portal auth SSO tenant connections',
          description: 'Returns SSO connections that belong to a portal SSO tenant.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.auth:read'] }))
      .query('default', Paginator.validate(v.object({})))
      .outputList(portalAuthSsoConnectionPresenter)
      .do(async ctx => {
        let list = await consumerAresService.listSsoConnections({
          ssoTenantId: ctx.ssoTenant.id,
          limit: ctx.query.limit,
          after: ctx.query.after,
          before: ctx.query.before,
          cursor: ctx.query.cursor,
          order: ctx.query.order
        });

        return Paginator.present(list, ssoConnection =>
          portalAuthSsoConnectionPresenter.present({ ssoConnection })
        );
      })
  }
);
