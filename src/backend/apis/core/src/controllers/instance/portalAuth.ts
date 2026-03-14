import {
  badRequestError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { introspectType, v } from '@lowerdeck/validation';
import { consumerAresService } from '@metorial/module-consumer';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { instancePath } from '../../middleware/instanceGroup';
import {
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

let portalAuthAppSchema = v.object({
  object: v.literal('portal.auth.app'),
  id: v.string({ description: 'The Ares app identifier for this portal.' }),
  client_id: v.string({ description: 'The Ares app client identifier.' }),
  slug: v.nullable(v.string({ description: 'The Ares app slug.' })),
  default_redirect_url: v.string({
    description: 'The default redirect URL configured for this portal auth app.',
    modifiers: [v.url()]
  }),
  redirect_domains: v.array(
    v.string({
      description: 'A hostname or wildcard hostname allowed for redirect callbacks.'
    })
  ),
  created_at: v.date(),
  updated_at: v.date()
});

let portalAuthAppOutput = {
  introspect: () => ({
    name: 'Portal Auth App',
    object: introspectType(portalAuthAppSchema)
  })
};

let normalizeRedirectDomains = (redirectDomains: string[]) => {
  return Array.from(
    new Set(
      redirectDomains
        .map(redirectDomain => redirectDomain.trim().toLowerCase())
        .filter(Boolean)
    )
  );
};

let presentPortalAuthApp = (app: Awaited<ReturnType<typeof consumerAresService.getApp>>) => ({
  object: 'portal.auth.app' as const,
  id: app.id,
  client_id: app.clientId,
  slug: app.slug ?? null,
  default_redirect_url: app.defaultRedirectUrl,
  redirect_domains: app.redirectDomains,
  created_at: app.createdAt,
  updated_at: app.updatedAt
});

let normalizeAresPagination = <T>(list: {
  items: T[];
  pagination: {
    has_more_after: boolean;
    has_more_before: boolean;
  };
}) => ({
  items: list.items,
  pagination: {
    hasNextPage: list.pagination.has_more_after,
    hasPreviousPage: list.pagination.has_more_before
  }
});

let portalAuthManagementGroup = portalGroup
  .use(isDashboardGroup())
  .use(hasFlags(['paid-portals', 'paid-sso-tenants']));

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
    description: 'Manage the Ares-backed authentication configuration for a portal.'
  },
  {
    getApp: portalAuthManagementGroup
      .get(instancePath('portals/:portalId/auth/app', 'portals.auth.app.get'), {
        name: 'Get portal auth app',
        description: 'Returns the Ares app configuration for a portal.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.auth:read'] }))
      .output(portalAuthAppOutput)
      .do(async ctx => {
        return presentPortalAuthApp(
          await consumerAresService.getApp({
            appId: getPortalAresAppId(ctx.portal)
          })
        );
      }),

    updateApp: portalAuthManagementGroup
      .patch(instancePath('portals/:portalId/auth/app', 'portals.auth.app.update'), {
        name: 'Update portal auth app',
        description: 'Updates the redirect-domain allowlist for a portal Ares app.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.auth:write'] }))
      .body(
        'default',
        v.object({
          redirect_domains: v.array(v.string())
        })
      )
      .output(portalAuthAppOutput)
      .do(async ctx => {
        return presentPortalAuthApp(
          await consumerAresService.updateApp({
            id: getPortalAresAppId(ctx.portal),
            redirectDomains: normalizeRedirectDomains(ctx.body.redirect_domains)
          })
        );
      }),

    listSsoTenants: portalAuthManagementGroup
      .get(instancePath('portals/:portalId/auth/sso-tenants', 'portals.auth.ssoTenants.list'), {
        name: 'List portal auth SSO tenants',
        description: 'Returns the SSO tenants configured for a portal Ares app.'
      })
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

        return Paginator.present(normalizeAresPagination(list), ssoTenant =>
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
          description: 'Creates an Ares setup URL for finishing portal SSO tenant configuration.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.auth:write'] }))
      .body(
        'default',
        v.object({
          redirect_url: v.string({ modifiers: [v.url()] })
        })
      )
      .output(portalAuthSsoTenantSetupPresenter)
      .do(async ctx => {
        let ssoTenantSetup = await consumerAresService.createSsoTenantSetup({
          ssoTenantId: ctx.ssoTenant.id,
          redirectUrl: ctx.body.redirect_url
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

        return Paginator.present(normalizeAresPagination(list), ssoConnection =>
          portalAuthSsoConnectionPresenter.present({ ssoConnection })
        );
      })
  }
);
