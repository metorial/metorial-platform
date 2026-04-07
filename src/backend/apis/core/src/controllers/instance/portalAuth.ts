import { badRequestError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerAresService } from '@metorial/module-consumer';
import { portalService } from '@metorial/module-portal';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
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

let paginateSsoTenantList = <T extends { id: string }>(
  sorted: T[],
  query: { limit?: number; after?: string; before?: string }
) => {
  let limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  let start = 0;
  let end = sorted.length;

  if (query.before) {
    let idx = sorted.findIndex(t => t.id == query.before);
    if (idx >= 0) {
      end = idx;
      start = Math.max(0, end - limit);
    }
  } else if (query.after) {
    let idx = sorted.findIndex(t => t.id == query.after);
    start = idx >= 0 ? idx + 1 : 0;
    end = Math.min(sorted.length, start + limit);
  } else {
    end = Math.min(sorted.length, start + limit);
  }

  let items = sorted.slice(start, end);
  let hasNextPage = end < sorted.length;
  let hasPreviousPage = start > 0;

  return {
    items,
    pagination: { hasNextPage, hasPreviousPage }
  };
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
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            id: v.optional(v.string()),
            status: v.optional(
              v.union([
                v.enumOf(['pending', 'completed']),
                v.array(v.enumOf(['pending', 'completed']))
              ])
            )
          })
        )
      )
      .outputList(portalAuthSsoTenantPresenter)
      .do(async ctx => {
        let appId = getPortalAresAppId(ctx.portal);
        let all = await consumerAresService.listSsoTenantsAll({ appId });

        let search = ctx.query.search?.trim().toLowerCase();
        let idFilter = ctx.query.id?.trim();
        let statuses = normalizeArrayParam(ctx.query.status);

        let filtered = all.filter(tenant => {
          if (idFilter && tenant.id != idFilter) {
            return false;
          }

          if (statuses?.length && !statuses.includes(tenant.status)) {
            return false;
          }

          if (search) {
            let hay = [tenant.id, tenant.name, tenant.clientId].join(' ').toLowerCase();
            if (!hay.includes(search)) {
              return false;
            }
          }

          return true;
        });

        let order = ctx.query.order == 'asc' ? 1 : -1;
        filtered.sort((a, b) => order * (a.createdAt.getTime() - b.createdAt.getTime()));

        let page = paginateSsoTenantList(filtered, {
          limit: ctx.query.limit,
          after: ctx.query.after,
          before: ctx.query.before
        });

        return Paginator.present(page, ssoTenant =>
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
