import {
  authClients,
  expectOk,
  metorialEndpoints,
  rest,
  uniqueId,
  type BootstrappedOrganization,
  type RestClient,
  type RestResponse
} from '@metorial/e2e';

export type CredentialName =
  | 'none'
  | 'session'
  | 'management'
  | 'instance'
  | 'otherSession'
  | 'otherManagement'
  | 'otherInstance';

export type AuthExpectation = Partial<Record<CredentialName, number | number[]>>;

export let instancePathFor = (org: BootstrappedOrganization, name: string, path: string) => {
  if (name === 'session' || name === 'otherSession') {
    return `/dashboard/instances/${org.ids.instanceId}${path}`;
  }
  if (name === 'management' || name === 'otherManagement') {
    return `/instances/${org.ids.instanceId}${path}`;
  }
  return path;
};

export let crossTenantClients = (
  org: BootstrappedOrganization,
  otherOrg: BootstrappedOrganization
): Record<CredentialName, RestClient> =>
  authClients(org, {
    otherSession: rest(metorialEndpoints().api, { session: otherOrg.session }),
    otherManagement: otherOrg.clients.management,
    otherInstance: otherOrg.clients.instance
  });

export let listAuth: AuthExpectation = {
  none: 401,
  session: 200,
  management: 200,
  instance: 200,
  otherSession: 404,
  otherManagement: 404
};

export let resourceAuth: AuthExpectation = { ...listAuth, otherInstance: 404 };

export let managementApi = (org: BootstrappedOrganization): RestClient => {
  let client = org.clients.management;
  let prefix = (path: string) => `/instances/${org.ids.instanceId}${path}`;

  return {
    ...client,
    get: (path: string, options?: any) => client.get(prefix(path), options),
    post: (path: string, body?: unknown, options?: any) =>
      client.post(prefix(path), body, options),
    patch: (path: string, body?: unknown, options?: any) =>
      client.patch(prefix(path), body, options),
    put: (path: string, body?: unknown, options?: any) =>
      client.put(prefix(path), body, options),
    delete: (path: string, options?: any) => client.delete(prefix(path), options)
  } as RestClient;
};

let describeResponse = (response: RestResponse) =>
  `${response.method} ${response.url} responded ${response.status}: ${response.text.slice(0, 500)}`;

let attempt = async (call: () => Promise<RestResponse>) => {
  let startedAt = Date.now();
  try {
    return { response: await call() };
  } catch (error) {
    return { failure: `threw after ${Date.now() - startedAt}ms: ${String(error)}` };
  }
};

export interface RouteAuthCase {
  path: string;
  expected: AuthExpectation;
}

export let expectRoutesAuth = async (
  org: BootstrappedOrganization,
  otherOrg: BootstrappedOrganization,
  routes: RouteAuthCase[]
) => {
  let clients = crossTenantClients(org, otherOrg);
  let mismatches: string[] = [];

  for (let route of routes) {
    for (let [name, statuses] of Object.entries(route.expected) as [
      CredentialName,
      number | number[]
    ][]) {
      let path = instancePathFor(org, name, route.path);
      let { response, failure } = await attempt(() => clients[name].get(path));
      let allowed = Array.isArray(statuses) ? statuses : [statuses];
      if (!response) {
        mismatches.push(`${name}: GET ${path} ${failure}`);
      } else if (!allowed.includes(response.status)) {
        mismatches.push(
          `${name}: expected ${allowed.join(' or ')}, ${describeResponse(response)}`
        );
      }
    }
  }

  if (mismatches.length > 0) {
    throw new Error(`Auth matrix mismatches:\n${mismatches.join('\n')}`);
  }
};

export interface ResponseCase {
  label: string;
  call: () => Promise<RestResponse>;
  status: number;
  code?: string;
}

export let expectResponses = async (cases: ResponseCase[]) => {
  let mismatches: string[] = [];

  for (let item of cases) {
    let { response, failure } = await attempt(item.call);
    if (!response) {
      mismatches.push(`${item.label}: ${failure}`);
    } else if (response.status !== item.status) {
      mismatches.push(`${item.label}: expected ${item.status}, ${describeResponse(response)}`);
    } else if (item.code !== undefined && response.body?.code !== item.code) {
      mismatches.push(
        `${item.label}: expected code ${item.code}, ${describeResponse(response)}`
      );
    }
  }

  if (mismatches.length > 0) {
    throw new Error(`Response mismatches:\n${mismatches.join('\n')}`);
  }
};

export let invalid = (label: string, call: () => Promise<RestResponse>): ResponseCase => ({
  label,
  call,
  status: 400,
  code: 'invalid_data'
});

export let notFound = (label: string, call: () => Promise<RestResponse>): ResponseCase => ({
  label,
  call,
  status: 404
});

export let createProviderDeployment = async (client: RestClient, providerId: string) =>
  expectOk(
    await client.post('/provider-deployments', {
      provider_id: providerId,
      name: uniqueId('e2e-deployment')
    })
  );

export let ids = (items: { id: string }[]) => items.map(item => item.id);

export let inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000);

export let workerTimeout = { timeoutMs: 60_000, intervalMs: 500 };
