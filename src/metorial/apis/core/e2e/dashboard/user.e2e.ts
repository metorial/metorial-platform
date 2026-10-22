import {
  authClients,
  bootstrapUser,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  metorialEndpoints,
  rest,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';

describe('api-core dashboard: user, boot, flags and scopes', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let orgPath = (path: string) => `/dashboard/organizations/${org.ids.organizationId}${path}`;

  let outsider = () => rest(metorialEndpoints().api, { session: otherOrg.session });

  let sessionFor = (session: string) => rest(metorialEndpoints().api, { session });

  it('serves the current user to user sessions only', async () => {
    let responses = await expectAuthMatrix(authClients(org), client => client.get('/user'), {
      none: 401,
      session: 200,
      management: 403,
      instance: 404
    });

    let user = expectPresented(responses.session.body, 'user');
    expect(user).toMatchObject({
      id: org.ids.userId,
      email: org.user.email,
      name: org.user.name,
      status: 'active',
      type: 'user'
    });
    expect(user).not.toHaveProperty('password_hash');

    expect(expectOk(await member.clients.rest.get('/user')).id).toBe(member.user.id);
  });

  it('updates the current user through POST /user and never deletes it', async () => {
    let user = await bootstrapUser();
    let client = sessionFor(user.session);
    let name = uniqueId('Renamed User');

    let updated = expectOk(await client.post('/user', { name }));
    expectPresented(updated, 'user');
    expect(updated).toMatchObject({ id: user.id, name, email: user.email, status: 'active' });

    let fetched = expectOk(await client.get('/user'));
    expect(fetched).toMatchObject({ name, status: 'active' });

    expectError(await client.post('/user', { name: 42 }), 400, 'invalid_data');
    expectError(await org.clients.management.post('/user', { name }), 403, 'forbidden');
    expectError(await rest(metorialEndpoints().api).post('/user', { name }), 401);
  });

  it("refuses to take over another user's email address", async () => {
    let user = await bootstrapUser();
    let other = await bootstrapUser();

    expectError(
      await sessionFor(user.session).post('/user', { email: other.email }),
      409,
      'conflict'
    );

    expect(expectOk(await sessionFor(user.session).get('/user')).email).toBe(user.email);
    expect(expectOk(await sessionFor(other.session).get('/user')).email).toBe(other.email);
  });

  it('boots a user with their organizations and memberships', async () => {
    let responses = await expectAuthMatrix(
      authClients(org, { member: sessionFor(member.user.session) }),
      client => client.post('/dashboard/boot', {}),
      { none: 401, session: 200, member: 200, management: 403, instance: 404 }
    );

    let boot = expectPresented(responses.session.body, 'metorial.boot');
    expect(boot.user.id).toBe(org.ids.userId);
    expect(boot.consumers).toEqual([]);

    let ownerOrg = boot.organizations.find((item: any) => item.id === org.ids.organizationId);
    expect(ownerOrg).toMatchObject({ object: 'organization', member: { role: 'admin' } });
    expect(boot.organizations.map((item: any) => item.id)).not.toContain(
      otherOrg.ids.organizationId
    );

    let memberBoot = responses.member.body;
    expect(memberBoot.user.id).toBe(member.user.id);
    expect(memberBoot.organizations.map((item: any) => item.id)).toEqual([
      org.ids.organizationId
    ]);
    expect(memberBoot.organizations[0].member).toMatchObject({
      id: member.member.id,
      role: 'member'
    });
  });

  it('boots a fresh user without organizations', async () => {
    let user = await bootstrapUser();

    let boot = expectOk(await sessionFor(user.session).post('/dashboard/boot', {}));
    expect(boot.user.id).toBe(user.id);
    expect(boot.organizations).toEqual([]);
    expect(boot.projects).toEqual([]);
    expect(boot.instances).toEqual([]);
  });

  it('serves boolean feature flags to dashboard members', async () => {
    let responses = await expectAuthMatrix(
      authClients(org, { member: member.clients.rest, otherSession: outsider() }),
      client => client.get(orgPath('/flags')),
      { none: 401, session: 200, member: 200, management: 403, otherSession: 404 }
    );

    let flags = expectPresented(responses.session.body, 'flags');
    let slugs = flags.flags.map((flag: any) => flag.slug);
    expect(flags.flags).toContainEqual({ slug: 'test-flag', value: true });
    expect(flags.flags).toContainEqual({ slug: 'paid-key-providers', value: true });
    expect(flags.flags.every((flag: any) => typeof flag.value === 'boolean')).toBe(true);
    expect(slugs).not.toContain('sandbox-max-vcpus');
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('evaluates flags for a project of the organization only', async () => {
    let withProject = expectOk(
      await org.clients.rest.get(orgPath('/flags'), {
        query: { project_id: org.ids.projectId }
      })
    );
    expect(withProject.flags).toContainEqual({ slug: 'test-flag', value: true });

    expectError(
      await org.clients.rest.get(orgPath('/flags'), {
        query: { project_id: otherOrg.ids.projectId }
      }),
      404,
      'not_found'
    );
    expectError(
      await org.clients.rest.get(orgPath('/flags'), {
        query: { project_id: uniqueId('prj') }
      }),
      404,
      'not_found'
    );
  });

  it("serves each member's effective organization scopes", async () => {
    let responses = await expectAuthMatrix(
      authClients(org, { member: member.clients.rest, otherSession: outsider() }),
      client => client.get(orgPath('/scopes')),
      { none: 401, session: 200, member: 200, management: 403, otherSession: 404 }
    );

    let adminScopes = expectPresented(responses.session.body, 'organization_scopes').scopes;
    expect(adminScopes).toEqual(
      expect.arrayContaining([
        'organization:read',
        'organization:write',
        'organization.member:write',
        'organization.project:manage'
      ])
    );
    expect(adminScopes.some((scope: string) => scope.startsWith('user:'))).toBe(false);

    let memberScopes = expectPresented(responses.member.body, 'organization_scopes').scopes;
    expect(memberScopes).toEqual(
      expect.arrayContaining(['organization:read', 'organization.project:read'])
    );
    expect(memberScopes).not.toContain('organization:write');
    expect(memberScopes).not.toContain('organization.project:manage');
    expect(memberScopes.every((scope: string) => adminScopes.includes(scope))).toBe(true);
  });
});
