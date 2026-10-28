import {
  authClients,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';

describe('api-core management: access policies', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let dashboardPath = (path: string) =>
    `/dashboard/organizations/${org.ids.organizationId}${path}`;

  let teamReadDocument = () => ({
    access: [{ target: org.ids.organizationId, scopes: ['organization.team:read'] }]
  });

  let createPolicy = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.management.post('/organization/access-policies', {
        name: uniqueId('Policy'),
        document: teamReadDocument(),
        ...body
      })
    );

  let clients = () =>
    authClients(org, {
      member: member.clients.rest,
      instanceKey: rest(metorialEndpoints().api, { apiKey: org.keys.instanceSecret }),
      otherSession: rest(metorialEndpoints().api, { session: otherOrg.session })
    });

  let pathFor = (name: string, path: string) =>
    ['session', 'member', 'otherSession'].includes(name)
      ? dashboardPath(path)
      : `/organization${path}`;

  it('lets members read access policies', async () => {
    let policy = await createPolicy();

    let lists = await expectAuthMatrix(
      clients(),
      (client, name) => client.get(pathFor(name, '/access-policies')),
      {
        none: 401,
        session: 200,
        management: 200,
        member: 200,
        instance: 404,
        instanceKey: 403,
        otherSession: 404
      }
    );
    expect(lists.member.body.items.map((item: any) => item.id)).toContain(policy.id);

    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(pathFor(name, `/access-policies/${policy.id}`)),
      {
        none: 401,
        session: 200,
        management: 200,
        member: 200,
        instance: 404,
        instanceKey: 403,
        otherSession: 404
      }
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(pathFor(name, `/access-policies/${policy.id}/versions`)),
      {
        none: 401,
        session: 200,
        management: 200,
        member: 200,
        instance: 404,
        instanceKey: 403,
        otherSession: 404
      }
    );
  });

  it('only lets admins and management keys write access policies', async () => {
    let created = await expectAuthMatrix(
      clients(),
      (client, name) =>
        client.post(pathFor(name, '/access-policies'), {
          name: uniqueId('Policy'),
          document: teamReadDocument()
        }),
      {
        none: 401,
        session: 200,
        management: 200,
        member: 403,
        instance: 404,
        instanceKey: 403,
        otherSession: 404
      }
    );
    expect(created.session.body.type).toBe('custom');

    let policy = await createPolicy();
    let memberClient = member.clients.rest;
    expectError(
      await memberClient.patch(dashboardPath(`/access-policies/${policy.id}`), {
        name: 'Renamed'
      }),
      403,
      'forbidden'
    );
    expectError(
      await memberClient.delete(dashboardPath(`/access-policies/${policy.id}`)),
      403,
      'forbidden'
    );
    expect(
      expectOk(await org.clients.management.get(`/organization/access-policies/${policy.id}`))
        .name
    ).toBe(policy.name);
  });

  it('runs the access policy lifecycle with versions and resolved targets', async () => {
    let role = expectOk(
      await org.clients.management.post('/organization/access-roles', {
        name: uniqueId('Role'),
        scopes: ['organization.team:read']
      })
    );
    let policy = await createPolicy({
      description: 'Initial',
      message: 'First version',
      document: {
        access: [
          { target: org.ids.projectId, scopes: ['instance.provider:read'] },
          { target: org.ids.instanceId, roles: [role.slug] }
        ]
      }
    });

    expectPresented(policy, 'management.access_policy');
    expect(policy).toMatchObject({
      type: 'custom',
      organization_id: org.ids.organizationId,
      description: 'Initial'
    });
    expect(policy.projects.map((item: any) => item.id)).toEqual([org.ids.projectId]);
    expect(policy.instances.map((item: any) => item.id)).toEqual([org.ids.instanceId]);
    expect(policy.roles.map((item: any) => item.id)).toEqual([role.id]);

    let bySlug = expectOk(
      await org.clients.management.get(`/organization/access-policies/${policy.slug}`)
    );
    expect(bySlug.id).toBe(policy.id);

    let updated = expectOk(
      await org.clients.management.patch(`/organization/access-policies/${policy.id}`, {
        name: `${policy.name} renamed`,
        description: null,
        message: 'Second version',
        document: teamReadDocument()
      })
    );
    expect(updated).toMatchObject({ name: `${policy.name} renamed`, description: null });
    expect(updated.projects).toEqual([]);
    expect(updated.instances).toEqual([]);
    expect(updated.roles).toEqual([]);
    expect(updated.document).toEqual(teamReadDocument());

    let versions = await listAll(
      org.clients.management,
      `/organization/access-policies/${policy.id}/versions`
    );
    versions.forEach(version => expectPresented(version, 'management.access_policy_version'));
    expect(versions.map(version => [version.index, version.message])).toEqual([
      [1, 'Second version'],
      [0, 'First version']
    ]);
    expect(versions.every(version => version.access_policy_id === policy.id)).toBe(true);

    expectOk(
      await org.clients.management.patch(`/organization/access-policies/${policy.id}`, {
        name: 'Name only'
      })
    );
    expect(
      await listAll(
        org.clients.management,
        `/organization/access-policies/${policy.id}/versions`
      )
    ).toHaveLength(2);

    let deleted = expectOk(
      await org.clients.management.delete(`/organization/access-policies/${policy.id}`)
    );
    expect(deleted.id).toBe(policy.id);
    expectError(
      await org.clients.management.get(`/organization/access-policies/${policy.id}`),
      404,
      'not_found'
    );
    expect(
      (await listAll(org.clients.management, '/organization/access-policies')).map(
        item => item.id
      )
    ).not.toContain(policy.id);
  });

  it('protects the default policies', async () => {
    let policies = await listAll(org.clients.management, '/organization/access-policies');
    let everyone = policies.find(item => item.type === 'everyone');
    let admin = policies.find(item => item.type === 'admin');
    expect(everyone).toBeDefined();
    expect(admin).toBeDefined();

    expectError(
      await org.clients.management.delete(`/organization/access-policies/${everyone.id}`),
      400,
      'bad_request'
    );
    expectError(
      await org.clients.management.delete(`/organization/access-policies/${admin.id}`),
      400,
      'bad_request'
    );
    expectError(
      await org.clients.management.patch(`/organization/access-policies/${admin.id}`, {
        document: teamReadDocument()
      }),
      400,
      'bad_request'
    );

    let unchanged = expectOk(
      await org.clients.management.get(`/organization/access-policies/${admin.id}`)
    );
    expect(unchanged.document).toEqual(admin.document);
  });

  it('validates access policy bodies and documents', async () => {
    let create = (body: unknown) =>
      org.clients.management.post('/organization/access-policies', body);
    let withAccess = (access: unknown) =>
      create({ name: uniqueId('Policy'), document: { access } });
    let orgId = org.ids.organizationId;

    expectError(await create({ document: teamReadDocument() }), 400, 'invalid_data');
    expectError(await create({ name: uniqueId('Policy') }), 400, 'invalid_data');
    expectError(await withAccess('everything'), 400, 'invalid_data');
    expectError(
      await withAccess([{ scopes: ['organization.team:read'] }]),
      400,
      'invalid_data'
    );
    expectError(
      await withAccess([{ target: orgId, scopes: 'organization.team:read' }]),
      400,
      'invalid_data'
    );

    expectError(
      await withAccess([{ target: orgId, scopes: ['organization.team:fly'] }]),
      400,
      'bad_request'
    );
    expectError(
      await withAccess([{ target: orgId, scopes: ['organization.team:write'] }]),
      400,
      'bad_request'
    );
    expectError(
      await withAccess([
        { target: `usr_${uniqueId('x')}`, scopes: ['organization.team:read'] }
      ]),
      400,
      'bad_request'
    );
    expectError(
      await withAccess([{ target: orgId, roles: [uniqueId('missing-role')] }]),
      404,
      'not_found'
    );

    let policy = await createPolicy();
    expectError(
      await org.clients.management.patch(`/organization/access-policies/${policy.id}`, {
        document: { access: [{ target: orgId, scopes: ['organization.member:write'] }] }
      }),
      400,
      'bad_request'
    );
    expect(
      expectOk(await org.clients.management.get(`/organization/access-policies/${policy.id}`))
        .document
    ).toEqual(teamReadDocument());
  });

  it('keeps access policies inside their organization', async () => {
    let policy = await createPolicy();
    let other = otherOrg.clients.management;
    let path = `/organization/access-policies/${policy.id}`;

    expectError(await other.get(path), 404, 'not_found');
    expectError(await other.get(`${path}/versions`), 404, 'not_found');
    expectError(await other.patch(path, { name: 'Taken over' }), 404, 'not_found');
    expectError(await other.delete(path), 404, 'not_found');
    expectError(
      await otherOrg.clients.rest.get(
        `/dashboard/organizations/${otherOrg.ids.organizationId}/access-policies/${policy.id}`
      ),
      404,
      'not_found'
    );

    let crossTargets = [
      { target: otherOrg.ids.organizationId, status: 400, code: 'bad_request' },
      { target: otherOrg.ids.projectId, status: 404, code: 'not_found' },
      { target: otherOrg.ids.instanceId, status: 404, code: 'not_found' }
    ];
    for (let { target, status, code } of crossTargets) {
      expectError(
        await org.clients.management.post('/organization/access-policies', {
          name: uniqueId('Policy'),
          document: { access: [{ target, scopes: ['organization.team:read'] }] }
        }),
        status,
        code
      );
    }

    let theirs = await listAll(other, '/organization/access-policies');
    expect(theirs.map(item => item.id)).not.toContain(policy.id);
    expect(expectOk(await org.clients.management.get(path)).name).toBe(policy.name);
  });

  it('pages through access policies and versions', async () => {
    let created = [await createPolicy(), await createPolicy(), await createPolicy()];

    let listed = await listAll(org.clients.management, '/organization/access-policies', {
      limit: 1
    });
    let ids = listed.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(created.map(policy => policy.id)));

    let policy = created[0];
    for (let scope of ['organization.member:read', 'organization.project:read']) {
      expectOk(
        await org.clients.management.patch(`/organization/access-policies/${policy.id}`, {
          document: { access: [{ target: org.ids.organizationId, scopes: [scope] }] }
        })
      );
    }
    let versions = await listAll(
      org.clients.management,
      `/organization/access-policies/${policy.id}/versions`,
      { limit: 1 }
    );
    expect(versions.map(version => version.index)).toEqual([2, 1, 0]);

    expectError(
      await org.clients.management.get('/organization/access-policies', {
        query: { limit: 0 }
      }),
      400,
      'invalid_data'
    );
  });
});
