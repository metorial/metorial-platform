import { uniqueId } from '@lowerdeck/testing-tools';
import { beforeAll } from 'vitest';
import {
  API_VERSIONS,
  dashboardSdk,
  expectOk,
  rest,
  SESSION_COOKIE,
  type RestClient
} from './api';
import { metorialEndpoints } from './env';

export interface BootstrappedUser {
  id: string;
  name: string;
  email: string;
  password: string;
  session: string;
}

export interface BootstrappedOrganization {
  ids: {
    userId: string;
    organizationId: string;
    projectId: string;
    instanceId: string;
  };
  user: BootstrappedUser;
  session: string;
  keys: {
    management: string;
    instanceSecret: string;
  };
  clients: {
    /** Dashboard (session) client scoped to the organization. */
    rest: RestClient;
    /** Organization management API key client. */
    management: RestClient;
    /** Instance secret API key client. */
    instance: RestClient;
    dashboard: ReturnType<typeof dashboardSdk>;
  };
}

export let readSessionCookie = (headers: Headers) => {
  for (let cookie of headers.getSetCookie()) {
    let [pair = ''] = cookie.split(';');
    let separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === SESSION_COOKIE) {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    }
  }
  return null;
};

/** Signs a fresh user up through the OSS auth API and returns its dashboard session. */
export let bootstrapUser = async (
  input: { name?: string; email?: string; password?: string } = {}
): Promise<BootstrappedUser> => {
  let api = rest(metorialEndpoints().api);
  let name = input.name ?? uniqueId('E2E User');
  let email = input.email ?? `${uniqueId('user')}@e2e.metorial.test`;
  let password = input.password ?? uniqueId('password');

  let signup = await api.post('/_/auth/signup', { name, email, password });
  expectOk(signup);
  let session = readSessionCookie(signup.headers);
  if (!session) throw new Error(`Signup did not set the ${SESSION_COOKIE} cookie`);

  let user = expectOk(await api.with({ session }).get('/user'));
  return { id: user.id, name, email, password, session };
};

/**
 * Creates a user, an organization, a project (which creates its production instance), an
 * organization management key and an instance secret key, all through the public HTTP API of the
 * stack's app-api/core-api.
 */
// Organization management tokens can no longer be created over REST, so the key is minted
// in-process. The module is imported by a computed specifier because module packages depend on
// `@metorial/e2e` for their own suites, and a static dependency would be a workspace cycle.
let machineAccessModule: string = '@metorial/module-machine-access';

let createManagementKey = async (ids: { organizationId: string; userId: string }) => {
  let { loadOrganizationFixture } = await import('./db');
  let { apiKeyService } = await import(machineAccessModule);
  let fixture = await loadOrganizationFixture(ids);

  let { secret } = await apiKeyService.createApiKey({
    type: 'organization_management_token',
    organization: fixture.organization,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('e2e-management') }
  });
  return secret.secret as string;
};

export let bootstrapOrganization = async (
  input: { user?: BootstrappedUser; name?: string } = {}
): Promise<BootstrappedOrganization> => {
  let api = metorialEndpoints().api;
  let user = input.user ?? (await bootstrapUser());
  let session = rest(api, { session: user.session });

  let organization = expectOk(
    await session.post('/dashboard/organizations', { name: input.name ?? uniqueId('E2E Org') })
  );
  let base = `/dashboard/organizations/${organization.id}`;
  let project = expectOk(
    await session.post(`${base}/projects`, { name: uniqueId('E2E Project') })
  );
  let instances = expectOk(
    await session.get(`${base}/instances`, { query: { project_id: project.id } })
  );
  let instance = instances.items?.[0];
  if (!instance) throw new Error(`Project ${project.id} has no instance`);

  let management = await createManagementKey({
    organizationId: organization.id,
    userId: user.id
  });
  let instanceSecret = expectOk(
    await session.post(`${base}/api-keys`, {
      type: 'instance_access_token_secret',
      instance_id: instance.id,
      name: uniqueId('e2e-instance')
    })
  );
  if (!instanceSecret.secret)
    throw new Error('API key creation did not return the key secret');

  return {
    ids: {
      userId: user.id,
      organizationId: organization.id,
      projectId: project.id,
      instanceId: instance.id
    },
    user,
    session: user.session,
    keys: {
      management,
      instanceSecret: instanceSecret.secret
    },
    clients: {
      rest: rest(api, { session: user.session, organizationId: organization.id }),
      management: rest(api, { apiKey: management }),
      instance: rest(api, { apiKey: instanceSecret.secret, version: API_VERSIONS.magnetar }),
      dashboard: dashboardSdk({
        session: user.session,
        organizationId: organization.id,
        instanceId: instance.id
      })
    }
  };
};

export interface BootstrappedMember {
  user: BootstrappedUser;
  /** The organization member record as presented by the dashboard API. */
  member: any;
  clients: { rest: RestClient };
}

/**
 * Adds a second user to an organization through a link invite that the new user accepts, so
 * role- and membership-dependent behavior can be tested against a non-owner.
 */
export let bootstrapMember = async (
  org: BootstrappedOrganization,
  input: { role?: 'member' | 'admin' } = {}
): Promise<BootstrappedMember> => {
  let api = metorialEndpoints().api;
  let base = `/dashboard/organizations/${org.ids.organizationId}`;

  let invite = expectOk(
    await org.clients.rest.post(`${base}/invites`, {
      type: 'link',
      role: input.role ?? 'member'
    })
  );
  let inviteKey = invite.invite_link?.key;
  if (!inviteKey) throw new Error('Link invite creation did not return an invite key');

  let user = await bootstrapUser();
  expectOk(
    await rest(api, { session: user.session }).post('/dashboard/organization-join/accept', {
      invite_key: inviteKey
    })
  );

  let members = expectOk(
    await org.clients.rest.get(`${base}/members`, { query: { limit: 100 } })
  );
  let member = members.items.find(
    (item: any) => item.user?.id === user.id || item.user_id === user.id
  );
  if (!member) throw new Error(`User ${user.id} did not become a member of ${base}`);

  return {
    user,
    member,
    clients: {
      rest: rest(api, { session: user.session, organizationId: org.ids.organizationId })
    }
  };
};

/**
 * Bootstraps one organization per test file in `beforeAll`. The returned object is a lazy view of
 * the fixture and may only be read inside tests and hooks.
 */
export let useFixture = <T extends object>(create: () => Promise<T>): T => {
  let value: T | undefined;
  beforeAll(async () => {
    value = await create();
  });
  return new Proxy({} as T, {
    get: (_, property) => {
      if (!value) {
        throw new Error('E2E fixtures are only available inside tests and hooks');
      }
      return value[property as keyof T];
    }
  });
};

export let useOrganization = (input: Parameters<typeof bootstrapOrganization>[0] = {}) =>
  useFixture(() => bootstrapOrganization(input));

/** Declare after the `useOrganization()` it joins, so the organization exists first. */
export let useMember = (
  org: BootstrappedOrganization,
  input: Parameters<typeof bootstrapMember>[1] = {}
) => useFixture(() => bootstrapMember(org, input));
