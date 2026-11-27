import {
  authClients,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  uniqueEmail,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';

describe('api-core management: organization', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let dashboardPath = (path: string) =>
    `/dashboard/organizations/${org.ids.organizationId}${path}`;

  let createEmailInvite = async (role: 'member' | 'admin' = 'member') =>
    expectOk(
      await org.clients.management.post('/organization/invites', {
        type: 'email',
        email: uniqueEmail('invitee'),
        role
      })
    );

  it('authenticates organization routes per credential', async () => {
    let clients = authClients(org, {
      otherSession: rest(metorialEndpoints().api, { session: otherOrg.session }),
      otherManagement: otherOrg.clients.management
    });

    let responses = await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(
          name === 'session' || name === 'otherSession'
            ? dashboardPath('/members')
            : '/organization/members'
        ),
      { none: 401, session: 200, management: 200, otherSession: [403, 404] }
    );
    expect(responses.management.body.items.map((item: any) => item.id)).toContain(
      member.member.id
    );

    let other = expectOk(await clients.otherManagement.get('/organization/members'));
    expect(other.items.map((item: any) => item.id)).not.toContain(member.member.id);
  });

  it('runs the invite lifecycle and never exposes email invite keys', async () => {
    let invite = await createEmailInvite();
    expectPresented(invite, 'organization.invite');
    expect(invite).toMatchObject({ status: 'pending', role: 'member', type: 'email' });
    expect(invite.invite_link.key).toBeNull();
    expect(invite.invite_link.url).toBeNull();

    let fetched = expectOk(
      await org.clients.management.get(`/organization/invites/${invite.id}`)
    );
    expect(fetched.id).toBe(invite.id);
    expect(fetched.invite_link.key).toBeNull();

    let updated = expectOk(
      await org.clients.management.post(`/organization/invites/${invite.id}`, {
        role: 'admin'
      })
    );
    expect(updated.role).toBe('admin');

    let deleted = expectOk(
      await org.clients.management.delete(`/organization/invites/${invite.id}`)
    );
    expect(deleted.status).toBe('deleted');
    expectError(
      await org.clients.management.delete(`/organization/invites/${invite.id}`),
      403,
      'forbidden'
    );

    let listed = await listAll(org.clients.management, '/organization/invites');
    expect(listed.map(item => item.id)).not.toContain(invite.id);
  });

  it('exposes the key of link invites', async () => {
    let link = expectOk(await org.clients.management.post('/organization/invites/ensure', {}));
    expectPresented(link, 'organization.invite');
    expect(link.type).toBe('link');
    expect(link.invite_link.key).toEqual(expect.any(String));

    let again = expectOk(
      await org.clients.management.post('/organization/invites/ensure', {})
    );
    expect(again.id).toBe(link.id);
  });

  it('validates invite bodies', async () => {
    let invites = (body: unknown) =>
      org.clients.management.post('/organization/invites', body);

    expectError(await invites({ type: 'email', role: 'member' }), 400, 'invalid_data');
    expectError(
      await invites({ type: 'email', email: uniqueEmail(), role: 'owner' }),
      400,
      'invalid_data'
    );
    expectError(await invites({ type: 'magic', role: 'member' }), 400, 'invalid_data');
    expectError(
      await invites({ type: 'email', email: org.user.email, role: 'member' }),
      403,
      'forbidden'
    );
  });

  it('pages through invites without gaps or duplicates', async () => {
    let created = [
      await createEmailInvite(),
      await createEmailInvite(),
      await createEmailInvite()
    ];

    let listed = await listAll(org.clients.management, '/organization/invites', { limit: 1 });
    let ids = listed.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(created.map(invite => invite.id)));

    expectError(
      await org.clients.management.get('/organization/invites', { query: { limit: 0 } }),
      400,
      'invalid_data'
    );
  });

  it('hides invites, members and projects of other organizations', async () => {
    let invite = await createEmailInvite();
    let other = otherOrg.clients.management;

    expectError(await other.get(`/organization/invites/${invite.id}`), 404, 'not_found');
    expectError(await other.delete(`/organization/invites/${invite.id}`), 404, 'not_found');
    expectError(
      await other.get(`/organization/members/${member.member.id}`),
      404,
      'not_found'
    );
    expectError(
      await other.get(`/organization/projects/${org.ids.projectId}`),
      404,
      'not_found'
    );

    expect(
      expectOk(await org.clients.management.get(`/organization/invites/${invite.id}`)).status
    ).toBe('pending');
  });

  it('updates members and protects the last admin', async () => {
    let path = `/organization/members/${member.member.id}`;

    let promoted = expectOk(await org.clients.management.post(path, { role: 'admin' }));
    expectPresented(promoted, 'organization.member');
    expect(promoted.role).toBe('admin');
    expectError(
      await org.clients.management.post(path, { role: 'owner' }),
      400,
      'invalid_data'
    );

    let demoted = expectOk(await org.clients.management.post(path, { role: 'member' }));
    expect(demoted.role).toBe('member');

    let owner = expectOk(await org.clients.rest.get(dashboardPath('/members'))).items.find(
      (item: any) => item.id !== member.member.id && item.role === 'admin'
    );
    let error = expectError(
      await org.clients.management.delete(`/organization/members/${owner.id}`),
      403,
      'forbidden'
    );
    expect(error.reason).toBe('last_admin');
  });

  it('serves projects by id and slug with the presenter shape', async () => {
    let project = expectOk(
      await org.clients.management.get(`/organization/projects/${org.ids.projectId}`)
    );
    expectPresented(project, 'organization.project');

    let bySlug = expectOk(
      await org.clients.management.get(`/organization/projects/${project.slug}`)
    );
    expect(bySlug.id).toBe(project.id);

    let renamed = expectOk(
      await org.clients.management.post(`/organization/projects/${project.id}`, {
        name: 'Renamed project'
      })
    );
    expect(renamed.name).toBe('Renamed project');
  });
});
