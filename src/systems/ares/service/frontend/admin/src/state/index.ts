import { isServiceError } from '@lowerdeck/error';
import { createLoader } from '@metorial-io/data-hooks';
import { adminClient } from './client';

let redirectToAuthIfNotAuthenticated = async <R>(fn: () => Promise<R>) => {
  if (typeof window === 'undefined') return new Promise(() => {}) as Promise<R>;

  try {
    return await fn();
  } catch (err) {
    if (isServiceError(err) && err.data.code == 'unauthorized') {
      window.location.replace('/login');
      return new Promise(() => {}) as Promise<R>;
    }

    throw err;
  }
};

export let usersState = createLoader({
  name: 'users',
  fetch: (d: { appId: string; search?: string; after?: string }) => {
    return redirectToAuthIfNotAuthenticated(() =>
      adminClient.user.list({
        appId: d.appId,
        search: d.search,
        after: d.after
      })
    );
  },
  mutators: {}
});

export let userState = createLoader({
  name: 'user',
  fetch: (d: { id: string }) => {
    return redirectToAuthIfNotAuthenticated(() => adminClient.user.get({ id: d.id }));
  },
  mutators: {}
});

export let adminsState = createLoader({
  name: 'admins',
  fetch: (d: { search?: string; after?: string }) => {
    return redirectToAuthIfNotAuthenticated(() =>
      adminClient.admin.list({
        after: d.after
      })
    );
  },
  mutators: {}
});

export let appsState = createLoader({
  name: 'apps',
  fetch: (d: { search?: string; after?: string }) => {
    return redirectToAuthIfNotAuthenticated(() =>
      adminClient.app.list({
        after: d.after
      })
    );
  },
  mutators: {}
});

export let appState = createLoader({
  name: 'app',
  fetch: (d: { id: string }) => {
    return redirectToAuthIfNotAuthenticated(() => adminClient.app.get({ id: d.id }));
  },
  mutators: {}
});

export let tenantsState = createLoader({
  name: 'tenants',
  fetch: (d: { appId: string; search?: string; after?: string }) => {
    return redirectToAuthIfNotAuthenticated(() =>
      adminClient.tenant.list({
        appId: d.appId,
        after: d.after
      })
    );
  },
  mutators: {}
});

export let tenantState = createLoader({
  name: 'tenant',
  fetch: (d: { id: string }) => {
    return redirectToAuthIfNotAuthenticated(() => adminClient.tenant.get({ id: d.id }));
  },
  mutators: {}
});

export let oauthProvidersState = createLoader({
  name: 'oauthProviders',
  fetch: (d: { appId: string }) => {
    return redirectToAuthIfNotAuthenticated(() =>
      adminClient.oauthProvider.list({ appId: d.appId })
    );
  },
  mutators: {}
});

export let ssoTenantsState = createLoader({
  name: 'ssoTenants',
  fetch: (d: { appId: string }) => {
    return redirectToAuthIfNotAuthenticated(() =>
      adminClient.sso.listTenants({ appId: d.appId })
    );
  },
  mutators: {}
});

export let ssoTenantState = createLoader({
  name: 'ssoTenant',
  fetch: (d: { id: string }) => {
    return redirectToAuthIfNotAuthenticated(() => adminClient.sso.getTenant({ id: d.id }));
  },
  mutators: {}
});

export let ssoConnectionsState = createLoader({
  name: 'ssoConnections',
  fetch: (d: { tenantId: string }) => {
    return redirectToAuthIfNotAuthenticated(() =>
      adminClient.sso.listConnections({ tenantId: d.tenantId })
    );
  },
  mutators: {}
});

export let auditLogsState = createLoader({
  name: 'auditLogs',
  fetch: (d: { appId: string; after?: string; type?: string }) => {
    return redirectToAuthIfNotAuthenticated(() =>
      adminClient.auditLog.list({
        appId: d.appId,
        after: d.after,
        type: d.type
      })
    );
  },
  mutators: {}
});

export let accessGroupsState = createLoader({
  name: 'accessGroups',
  fetch: (d: { appId: string }) => {
    return redirectToAuthIfNotAuthenticated(() =>
      adminClient.accessGroup.list({ appId: d.appId })
    );
  },
  mutators: {}
});

export let accessGroupState = createLoader({
  name: 'accessGroup',
  fetch: (d: { id: string }) => {
    return redirectToAuthIfNotAuthenticated(() => adminClient.accessGroup.get({ id: d.id }));
  },
  mutators: {}
});

export let appAccessGroupAssignmentsState = createLoader({
  name: 'appAccessGroupAssignments',
  fetch: (d: { appId: string }) => {
    return redirectToAuthIfNotAuthenticated(() =>
      adminClient.accessGroup.listAppAssignments({ appId: d.appId })
    );
  },
  mutators: {}
});

export let globalSsoTenantsState = createLoader({
  name: 'globalSsoTenants',
  fetch: () => {
    return redirectToAuthIfNotAuthenticated(() => adminClient.sso.listGlobalTenants({}));
  },
  mutators: {}
});
