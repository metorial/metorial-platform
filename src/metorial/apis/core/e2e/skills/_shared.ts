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
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { documentService } from '@metorial/module-documents';
import { skillService } from '@metorial/module-skill';
import { storeVersionService } from '@metorial/module-store';

export type CredentialName =
  | 'none'
  | 'session'
  | 'member'
  | 'management'
  | 'instance'
  | 'otherSession'
  | 'otherManagement'
  | 'otherInstance';

export type AuthExpectation = Partial<Record<CredentialName, number | number[]>>;

let dashboardCredentials = ['session', 'member', 'otherSession'];
let managementCredentials = ['management', 'otherManagement'];

export let listAuth: AuthExpectation = {
  none: 401,
  session: 200,
  member: 200,
  management: 200,
  instance: 200,
  otherSession: 404,
  otherManagement: 404
};

export let resourceAuth: AuthExpectation = { ...listAuth, otherInstance: 404 };

export let dashboardOnlyResourceAuth: AuthExpectation = {
  ...resourceAuth,
  instance: 404
};

export let instancePathFor = (org: BootstrappedOrganization, name: string, path: string) => {
  if (dashboardCredentials.includes(name)) {
    return `/dashboard/instances/${org.ids.instanceId}${path}`;
  }
  if (managementCredentials.includes(name)) return `/instances/${org.ids.instanceId}${path}`;

  return path;
};

export let skillClients = (
  org: BootstrappedOrganization,
  otherOrg: BootstrappedOrganization,
  member: { clients: { rest: RestClient } }
): Record<CredentialName, RestClient> =>
  authClients(org, {
    member: member.clients.rest,
    otherSession: rest(metorialEndpoints().api, { session: otherOrg.session }),
    otherManagement: otherOrg.clients.management,
    otherInstance: otherOrg.clients.instance
  });

export let prefixed = (client: RestClient, prefix: string): RestClient =>
  ({
    ...client,
    get: (path: string, options?: any) => client.get(`${prefix}${path}`, options),
    post: (path: string, body?: unknown, options?: any) =>
      client.post(`${prefix}${path}`, body, options),
    patch: (path: string, body?: unknown, options?: any) =>
      client.patch(`${prefix}${path}`, body, options),
    put: (path: string, body?: unknown, options?: any) =>
      client.put(`${prefix}${path}`, body, options),
    delete: (path: string, options?: any) => client.delete(`${prefix}${path}`, options)
  }) as RestClient;

export let dashboardApi = (org: BootstrappedOrganization) =>
  prefixed(org.clients.rest, `/dashboard/instances/${org.ids.instanceId}`);

export let managementApi = (org: BootstrappedOrganization) =>
  prefixed(org.clients.management, `/instances/${org.ids.instanceId}`);

export let memberApi = (
  org: BootstrappedOrganization,
  member: { clients: { rest: RestClient } }
) => prefixed(member.clients.rest, `/dashboard/instances/${org.ids.instanceId}`);

let describeResponse = (response: RestResponse) =>
  `${response.method} ${response.url} responded ${response.status}: ${response.text.slice(0, 500)}`;

export interface RouteAuthCase {
  label: string;
  call: (client: RestClient, path: (path: string) => string) => Promise<RestResponse>;
  expected: AuthExpectation;
}

export let expectRoutesAuth = async (
  org: BootstrappedOrganization,
  clients: Record<CredentialName, RestClient>,
  routes: RouteAuthCase[]
) => {
  let mismatches: string[] = [];

  for (let route of routes) {
    for (let [name, statuses] of Object.entries(route.expected) as [
      CredentialName,
      number | number[]
    ][]) {
      let response = await route.call(clients[name], path => instancePathFor(org, name, path));
      let allowed = Array.isArray(statuses) ? statuses : [statuses];

      if (!allowed.includes(response.status)) {
        mismatches.push(
          `${route.label} as ${name}: expected ${allowed.join(' or ')}, ${describeResponse(response)}`
        );
      }
    }
  }

  if (mismatches.length > 0) {
    throw new Error(`Auth matrix mismatches:\n${mismatches.join('\n')}`);
  }
};

export let getRoute = (path: string, expected: AuthExpectation): RouteAuthCase => ({
  label: `GET ${path}`,
  call: (client, route) => client.get(route(path)),
  expected
});

export interface ResponseCase {
  label: string;
  call: () => Promise<RestResponse>;
  status: number;
  code?: string;
}

export let expectResponses = async (cases: ResponseCase[]) => {
  let mismatches: string[] = [];

  for (let item of cases) {
    let response = await item.call();

    if (response.status !== item.status) {
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

export let badRequest = (label: string, call: () => Promise<RestResponse>): ResponseCase => ({
  label,
  call,
  status: 400
});

export let notFound = (label: string, call: () => Promise<RestResponse>): ResponseCase => ({
  label,
  call,
  status: 404
});

export let forbidden = (label: string, call: () => Promise<RestResponse>): ResponseCase => ({
  label,
  call,
  status: 403
});

export let ids = (items: { id: string }[]) => items.map(item => item.id);

export let createSkill = async (client: RestClient, body: Record<string, unknown> = {}) =>
  expectOk(await client.post('/skills', { name: uniqueId('e2e-skill'), ...body }));

export let createIntegration = async (client: RestClient) =>
  expectOk(await client.post('/integrations', { name: uniqueId('e2e-integration') }));

export let privileged = createResourceAuthorization({ restricted: false });

export let scopeOf = (fixture: OrganizationFixture) => ({
  project: fixture.project,
  instance: fixture.instance
});

export let getSkillRecord = (fixture: OrganizationFixture, skillId: string) =>
  skillService.getSkillById({ ...scopeOf(fixture), skillId });

export let forkSkillInProcess = async (fixture: OrganizationFixture, upstreamId: string) =>
  await skillService.createSkill({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    parentSkill: await getSkillRecord(fixture, upstreamId),
    parentSkillCloneType: 'fork',
    input: {
      id: await ID.generateId('skill'),
      authorization: privileged,
      name: uniqueId('e2e-fork')
    }
  });

export let uniquePath = (prefix = 'doc') => `/${uniqueId(prefix)}.md`;

export let addDocument = async (
  fixture: OrganizationFixture,
  skillId: string,
  path: string,
  content: string
) => {
  let skill = await getSkillRecord(fixture, skillId);

  return await documentService.createDocument({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    input: {
      title: path.split('/').at(-1)!,
      content,
      authorization: privileged,
      store: { id: skill.store!.id, path }
    }
  });
};

export let snapshotSkill = async (fixture: OrganizationFixture, skillId: string) => {
  let skill = await getSkillRecord(fixture, skillId);
  return await storeVersionService.createStoreVersionSnapshotNow({ storeId: skill.store!.id });
};

let organizationScope = (fixture: OrganizationFixture) => ({
  organizationOid: fixture.organization.oid,
  projectOid: fixture.project.oid,
  instanceOid: fixture.instance.oid
});

let seedDestination = async () =>
  await db.skillDestination.create({
    data: {
      id: await ID.generateId('skillDestination'),
      codeBucketId: uniqueId('e2e-code-bucket')
    }
  });

export let seedMarketplace = async (fixture: OrganizationFixture) => {
  let destination = await seedDestination();

  return await db.skillMarketplace.create({
    data: {
      id: await ID.generateId('skillMarketplace'),
      name: uniqueId('e2e-marketplace'),
      description: 'Seeded by the api-core skills suite',
      slug: uniqueId('e2e-marketplace').toLowerCase(),
      ...organizationScope(fixture),
      destinationOid: destination.oid
    }
  });
};

export let seedPlugin = async (fixture: OrganizationFixture) => {
  let destination = await seedDestination();

  return await db.skillPlugin.create({
    data: {
      id: await ID.generateId('skillPlugin'),
      name: uniqueId('e2e-plugin'),
      description: 'Seeded by the api-core skills suite',
      slug: uniqueId('e2e-plugin').toLowerCase(),
      category: 'testing',
      ...organizationScope(fixture),
      destinationOid: destination.oid
    }
  });
};
