import {
  authClients,
  bootstrapUser,
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

describe('api-core dashboard: organizations', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let mutableOrg = useOrganization();
  let member = useMember(org);

  let orgPath = (path = '', organizationId = org.ids.organizationId) =>
    `/dashboard/organizations/${organizationId}${path}`;

  let outsider = () => rest(metorialEndpoints().api, { session: otherOrg.session });

  let sessionFor = (session: string) => rest(metorialEndpoints().api, { session });

  it('creates organizations owned by the signed-in user', async () => {
    let user = await bootstrapUser();
    let client = sessionFor(user.session);
    let name = uniqueId('Created Org');

    let created = expectOk(await client.post('/dashboard/organizations', { name }));
    expectPresented(created, 'organization');
    expect(created).toMatchObject({ name, type: 'default', magic_mcp_origin: null });
    expect(created.slug).toEqual(expect.any(String));
    expect(created.image_url).toEqual(expect.any(String));

    let listed = await listAll(client, '/dashboard/organizations');
    expect(listed.map(item => item.id)).toEqual([created.id]);

    let scopes = expectOk(await client.get(orgPath('/scopes', created.id)));
    expect(scopes.scopes).toContain('organization:write');

    expectError(await outsider().get(orgPath('', created.id)), 404, 'not_found');
  });

  it('validates organization creation and only accepts dashboard sessions', async () => {
    let clients = authClients(org);
    let body = { name: uniqueId('Matrix Org') };

    await expectAuthMatrix(clients, client => client.post('/dashboard/organizations', body), {
      none: 401,
      management: 403,
      instance: 404
    });

    expectError(
      await org.clients.rest.post('/dashboard/organizations', {}),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.rest.post('/dashboard/organizations', { name: 42 }),
      400,
      'invalid_data'
    );
  });

  it('pages through the organizations of a user without gaps or duplicates', async () => {
    let user = await bootstrapUser();
    let client = sessionFor(user.session);

    let created = [];
    for (let index = 0; index < 3; index++) {
      created.push(
        expectOk(
          await client.post('/dashboard/organizations', {
            name: uniqueId(`Paged Org ${index}`)
          })
        )
      );
    }

    let listed = await listAll(client, '/dashboard/organizations', { limit: 1 });
    let ids = listed.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(created.map(item => item.id).sort());

    expectError(
      await client.get('/dashboard/organizations', { query: { limit: 0 } }),
      400,
      'invalid_data'
    );
  });

  it('lists only the organizations a user is a member of', async () => {
    let ownerList = await listAll(sessionFor(org.session), '/dashboard/organizations');
    expect(ownerList.map(item => item.id)).toContain(org.ids.organizationId);
    expect(ownerList.map(item => item.id)).not.toContain(otherOrg.ids.organizationId);

    let memberList = await listAll(
      sessionFor(member.user.session),
      '/dashboard/organizations'
    );
    expect(memberList.map(item => item.id)).toEqual([org.ids.organizationId]);

    expectError(
      await org.clients.management.get('/dashboard/organizations'),
      403,
      'forbidden'
    );
  });

  it('serves an organization by id and slug to its members', async () => {
    let clients = authClients(org, {
      member: member.clients.rest,
      otherSession: outsider()
    });

    let responses = await expectAuthMatrix(clients, client => client.get(orgPath()), {
      none: 401,
      session: 200,
      management: 200,
      member: 200,
      otherSession: 404
    });

    let organization = expectPresented(responses.session.body, 'organization');
    expect(organization.id).toBe(org.ids.organizationId);
    expect(responses.member.body.id).toBe(org.ids.organizationId);

    let bySlug = expectOk(await sessionFor(org.session).get(orgPath('', organization.slug)));
    expect(bySlug.id).toBe(org.ids.organizationId);

    expectError(
      await sessionFor(org.session).get(orgPath('', uniqueId('org'))),
      404,
      'not_found'
    );
  });

  it.fails(
    "rejects another organization's id for a management key (bug: organizationGroup ignores :organizationId for machine auth)",
    async () => {
      expectError(await otherOrg.clients.management.get(orgPath()), 404, 'not_found');
    }
  );

  it('updates an organization for admins only', async () => {
    let path = orgPath('', mutableOrg.ids.organizationId);
    let name = uniqueId('Renamed Org');

    let updated = expectOk(await mutableOrg.clients.rest.patch(path, { name }));
    expectPresented(updated, 'organization');
    expect(updated.name).toBe(name);
    expect(expectOk(await mutableOrg.clients.rest.get(path)).name).toBe(name);

    let withOrigin = expectOk(
      await mutableOrg.clients.rest.patch(path, {
        magic_mcp_origin: ' https://mcp.example.com/some/path '
      })
    );
    expect(withOrigin.magic_mcp_origin).toBe('https://mcp.example.com');

    let cleared = expectOk(
      await mutableOrg.clients.rest.patch(path, { magic_mcp_origin: null })
    );
    expect(cleared.magic_mcp_origin).toBeNull();
    expect(cleared.name).toBe(name);

    expectError(
      await member.clients.rest.patch(orgPath(), { name: uniqueId('Member Rename') }),
      403,
      'forbidden'
    );
    expectError(
      await org.clients.management.patch(orgPath(), { name: uniqueId('Key Rename') }),
      403,
      'forbidden'
    );
    expectError(
      await outsider().patch(path, { name: uniqueId('Outsider Rename') }),
      404,
      'not_found'
    );
    expect(expectOk(await mutableOrg.clients.rest.get(path)).name).toBe(name);
  });

  it('validates organization updates', async () => {
    let path = orgPath('', mutableOrg.ids.organizationId);

    expectError(await mutableOrg.clients.rest.patch(path, { name: 42 }), 400, 'invalid_data');
    expectError(
      await mutableOrg.clients.rest.patch(path, { magic_mcp_origin: 'not a url' }),
      400,
      'bad_request'
    );
    expectError(
      await mutableOrg.clients.rest.patch(path, { magic_mcp_origin: 'ftp://mcp.example.com' }),
      400,
      'bad_request'
    );
  });

  it('does not delete organizations', async () => {
    expectError(await member.clients.rest.delete(orgPath()), 403, 'forbidden');
    expectError(await org.clients.rest.delete(orgPath()), 501, 'not_implemented');
    expectError(await outsider().delete(orgPath()), 404, 'not_found');

    expect(expectOk(await org.clients.rest.get(orgPath())).id).toBe(org.ids.organizationId);
  });

  it('serves and updates the organization profile', async () => {
    let path = orgPath('/profile', mutableOrg.ids.organizationId);

    let profile = expectOk(await mutableOrg.clients.rest.get(path));
    expectPresented(profile, 'profile');
    expect(profile.badges).toEqual([]);

    let name = uniqueId('Profile');
    let updated = expectOk(
      await mutableOrg.clients.rest.patch(path, { name, description: 'A profile' })
    );
    expect(updated).toMatchObject({ id: profile.id, name, description: 'A profile' });

    let cleared = expectOk(await mutableOrg.clients.rest.patch(path, { description: null }));
    expect(cleared).toMatchObject({ id: profile.id, name, description: null });
    expect(expectOk(await mutableOrg.clients.rest.get(path)).description).toBeNull();

    expectError(await mutableOrg.clients.rest.patch(path, { name: 42 }), 400, 'invalid_data');
  });

  it('authorizes the organization profile per credential and role', async () => {
    let clients = authClients(org, {
      member: member.clients.rest,
      otherSession: outsider()
    });

    await expectAuthMatrix(clients, client => client.get(orgPath('/profile')), {
      none: 401,
      session: 200,
      management: 403,
      member: 200,
      otherSession: 404
    });

    expectError(
      await member.clients.rest.patch(orgPath('/profile'), { name: uniqueId('Member') }),
      403,
      'forbidden'
    );
  });

  it('configures audit log retention for admins only', async () => {
    let path = orgPath('/configure/audit-log-retention', mutableOrg.ids.organizationId);

    let current = expectOk(await mutableOrg.clients.rest.get(path));
    expectPresented(current, 'organization.audit_log_retention_configuration');
    expect(current.organization_id).toBe(mutableOrg.ids.organizationId);

    let updated = expectOk(
      await mutableOrg.clients.rest.patch(path, { audit_log_retention_in_days: 45 })
    );
    expect(updated.audit_log_retention_in_days).toBe(45);
    expect(expectOk(await mutableOrg.clients.rest.get(path)).audit_log_retention_in_days).toBe(
      45
    );

    for (let body of [
      {},
      { audit_log_retention_in_days: 0 },
      { audit_log_retention_in_days: 1.5 },
      { audit_log_retention_in_days: 'forever' }
    ]) {
      expectError(await mutableOrg.clients.rest.patch(path, body), 400, 'invalid_data');
    }

    let memberPath = orgPath('/configure/audit-log-retention');
    expect(expectOk(await member.clients.rest.get(memberPath)).organization_id).toBe(
      org.ids.organizationId
    );
    expectError(
      await member.clients.rest.patch(memberPath, { audit_log_retention_in_days: 10 }),
      403,
      'forbidden'
    );
    expectError(await outsider().get(path), 404, 'not_found');
    expectError(await mutableOrg.clients.management.get(path), 403, 'forbidden');
  });

  it('serves organization configs and layouts without declared types', async () => {
    for (let resource of ['configs', 'layouts']) {
      let listed = expectOk(await org.clients.rest.get(orgPath(`/${resource}`)));
      expect(listed.items).toEqual([]);

      let selector = uniqueId('unknown.selector');
      expectError(
        await org.clients.rest.get(orgPath(`/${resource}/${selector}`)),
        404,
        'not_found'
      );
      expectError(
        await org.clients.rest.put(orgPath(`/${resource}/${selector}`), { value: true }),
        404,
        'not_found'
      );

      expect(expectOk(await member.clients.rest.get(orgPath(`/${resource}`))).items).toEqual(
        []
      );
      expectError(await outsider().get(orgPath(`/${resource}`)), 404, 'not_found');
      expectError(await org.clients.management.get(orgPath(`/${resource}`)), 403, 'forbidden');
      expectError(await rest(metorialEndpoints().api).get(orgPath(`/${resource}`)), 401);
    }
  });
});
