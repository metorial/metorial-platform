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

describe('api-core management: access roles', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let dashboardPath = (path: string) =>
    `/dashboard/organizations/${org.ids.organizationId}${path}`;

  let createRole = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.management.post('/organization/access-roles', {
        name: uniqueId('Role'),
        scopes: ['organization.team:read'],
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

  it('lets members read access roles', async () => {
    let role = await createRole();

    for (let path of [
      '/access-roles',
      `/access-roles/${role.id}`,
      `/access-roles/${role.id}/versions`
    ]) {
      await expectAuthMatrix(clients(), (client, name) => client.get(pathFor(name, path)), {
        none: 401,
        session: 200,
        management: 200,
        member: 200,
        instance: 404,
        instanceKey: 403,
        otherSession: 404
      });
    }
  });

  it('only lets admins and management keys write access roles', async () => {
    await expectAuthMatrix(
      clients(),
      (client, name) =>
        client.post(pathFor(name, '/access-roles'), {
          name: uniqueId('Role'),
          scopes: ['organization.team:read']
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

    let role = await createRole();
    expectError(
      await member.clients.rest.patch(dashboardPath(`/access-roles/${role.id}`), {
        scopes: []
      }),
      403,
      'forbidden'
    );
    expectError(
      await member.clients.rest.delete(dashboardPath(`/access-roles/${role.id}`)),
      403,
      'forbidden'
    );
    expect(
      expectOk(await org.clients.management.get(`/organization/access-roles/${role.id}`))
        .scopes
    ).toEqual(['organization.team:read']);
  });

  it('runs the access role lifecycle and records scope changes', async () => {
    let role = await createRole({
      description: 'Initial',
      message: 'Created',
      scopes: ['organization.team:read', 'organization.member:read']
    });
    expectPresented(role, 'management.access_role');
    expect(role).toMatchObject({
      organization_id: org.ids.organizationId,
      is_admin: false,
      description: 'Initial',
      scopes: ['organization.team:read', 'organization.member:read']
    });

    let bySlug = expectOk(
      await org.clients.management.get(`/organization/access-roles/${role.slug}`)
    );
    expect(bySlug.id).toBe(role.id);

    let updated = expectOk(
      await org.clients.management.patch(`/organization/access-roles/${role.id}`, {
        name: `${role.name} renamed`,
        scopes: ['organization.team:read', 'organization.team:write'],
        message: 'Team writer'
      })
    );
    expect(updated.name).toBe(`${role.name} renamed`);
    expect([...updated.scopes].sort()).toEqual([
      'organization.team:read',
      'organization.team:write'
    ]);

    expectOk(
      await org.clients.management.patch(`/organization/access-roles/${role.id}`, {
        description: null
      })
    );

    let versions = await listAll(
      org.clients.management,
      `/organization/access-roles/${role.id}/versions`
    );
    versions.forEach(version => expectPresented(version, 'management.access_role_version'));
    expect(versions.map(version => version.index)).toEqual([1, 0]);
    expect(versions[0]).toMatchObject({
      access_role_id: role.id,
      message: 'Team writer',
      scopes_added: ['organization.team:write'],
      scopes_removed: ['organization.member:read']
    });
    expect(versions[1]).toMatchObject({ message: 'Created', scopes_removed: [] });

    expect(
      expectOk(await org.clients.management.delete(`/organization/access-roles/${role.id}`)).id
    ).toBe(role.id);
    expectError(
      await org.clients.management.get(`/organization/access-roles/${role.id}`),
      404,
      'not_found'
    );
  });

  it('refuses to delete roles that policies still reference', async () => {
    let role = await createRole();
    let policy = expectOk(
      await org.clients.management.post('/organization/access-policies', {
        name: uniqueId('Policy'),
        document: { access: [{ target: org.ids.organizationId, roles: [role.id] }] }
      })
    );

    expectError(
      await org.clients.management.delete(`/organization/access-roles/${role.id}`),
      400,
      'bad_request'
    );

    expectOk(
      await org.clients.management.delete(`/organization/access-policies/${policy.id}`)
    );
    expectOk(await org.clients.management.delete(`/organization/access-roles/${role.id}`));
  });

  it('validates access role bodies', async () => {
    let create = (body: unknown) =>
      org.clients.management.post('/organization/access-roles', body);

    expectError(await create({ scopes: ['organization.team:read'] }), 400, 'invalid_data');
    expectError(
      await create({ name: uniqueId('Role'), scopes: 'organization.team:read' }),
      400,
      'invalid_data'
    );
    expectError(
      await create({ name: uniqueId('Role'), scopes: ['organization.team:fly'] }),
      400,
      'bad_request'
    );
    expectError(
      await create({ name: uniqueId('Role'), scopes: ['organization.team:write'] }),
      400,
      'bad_request'
    );

    let role = await createRole();
    expectError(
      await org.clients.management.patch(`/organization/access-roles/${role.id}`, {
        scopes: ['instance.provider:write']
      }),
      400,
      'bad_request'
    );
    expect(
      expectOk(await org.clients.management.get(`/organization/access-roles/${role.id}`))
        .scopes
    ).toEqual(['organization.team:read']);
  });

  it('keeps access roles inside their organization', async () => {
    let role = await createRole();
    let other = otherOrg.clients.management;
    let path = `/organization/access-roles/${role.id}`;

    expectError(await other.get(path), 404, 'not_found');
    expectError(await other.get(`${path}/versions`), 404, 'not_found');
    expectError(await other.patch(path, { name: 'Taken over' }), 404, 'not_found');
    expectError(await other.delete(path), 404, 'not_found');
    expectError(
      await other.post('/organization/access-policies', {
        name: uniqueId('Policy'),
        document: { access: [{ target: otherOrg.ids.organizationId, roles: [role.id] }] }
      }),
      404,
      'not_found'
    );

    let theirs = await listAll(other, '/organization/access-roles');
    expect(theirs.map(item => item.id)).not.toContain(role.id);
  });

  it('pages through access roles', async () => {
    let created = [await createRole(), await createRole(), await createRole()];

    let listed = await listAll(org.clients.management, '/organization/access-roles', {
      limit: 1
    });
    let ids = listed.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(created.map(role => role.id)));
  });
});
