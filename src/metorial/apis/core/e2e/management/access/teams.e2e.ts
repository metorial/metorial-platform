import {
  authClients,
  bootstrapMember,
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

describe('api-core management: teams', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let dashboardPath = (path: string) =>
    `/dashboard/organizations/${org.ids.organizationId}${path}`;

  let createTeam = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.management.post('/organization/teams', {
        name: uniqueId('Team'),
        ...body
      })
    );

  let createTeamPolicy = async () =>
    expectOk(
      await org.clients.management.post('/organization/access-policies', {
        name: uniqueId('Team writers'),
        document: {
          access: [
            {
              target: org.ids.organizationId,
              scopes: ['organization.team:read', 'organization.team:write']
            }
          ]
        }
      })
    );

  let teamMemberIds = async (teamId: string) =>
    (
      await listAll(org.clients.management, '/organization/members', {
        query: { team_id: teamId }
      })
    ).map(item => item.id);

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

  it('lets members read teams', async () => {
    let team = await createTeam();

    for (let path of ['/teams', `/teams/${team.id}`]) {
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

  it('only lets admins and management keys change teams', async () => {
    let created = await expectAuthMatrix(
      clients(),
      (client, name) => client.post(pathFor(name, '/teams'), { name: uniqueId('Team') }),
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
    expect(created.session.body.object).toBe('management.team');

    let team = await createTeam();
    let policy = await createTeamPolicy();
    let memberClient = member.clients.rest;

    expectError(
      await memberClient.post(dashboardPath(`/teams/${team.id}`), { name: 'Renamed' }),
      403,
      'forbidden'
    );
    expectError(
      await memberClient.post(dashboardPath(`/teams/${team.id}/members`), {
        actor_id: member.member.actor_id
      }),
      403,
      'forbidden'
    );
    expectError(
      await memberClient.post(dashboardPath(`/teams/${team.id}/policies`), {
        access_policy_id: policy.id
      }),
      403,
      'forbidden'
    );

    let unchanged = expectOk(
      await org.clients.management.get(`/organization/teams/${team.id}`)
    );
    expect(unchanged.name).toBe(team.name);
    expect(unchanged.policies).toEqual([]);
    expect(await teamMemberIds(team.id)).toEqual([]);
  });

  it('creates, resolves, updates and lists teams', async () => {
    let team = await createTeam({ description: 'Initial' });
    expectPresented(team, 'management.team');
    expect(team).toMatchObject({
      organization_id: org.ids.organizationId,
      description: 'Initial',
      policies: [],
      projects: []
    });

    let bySlug = expectOk(
      await org.clients.management.get(`/organization/teams/${team.slug}`)
    );
    expect(bySlug.id).toBe(team.id);

    let updated = expectOk(
      await org.clients.management.post(`/organization/teams/${team.id}`, {
        name: `${team.name} renamed`
      })
    );
    expect(updated).toMatchObject({
      name: `${team.name} renamed`,
      description: 'Initial',
      slug: team.slug
    });

    let listed = await listAll(org.clients.rest, dashboardPath('/teams'));
    expect(listed.find(item => item.id === team.id)?.name).toBe(`${team.name} renamed`);
  });

  it('adds and removes team members', async () => {
    let team = await createTeam();
    let membersPath = `/organization/teams/${team.id}/members`;

    expectOk(
      await org.clients.management.post(membersPath, { actor_id: member.member.actor_id })
    );
    expectOk(
      await org.clients.management.post(membersPath, { actor_id: member.member.actor_id })
    );
    expect(await teamMemberIds(team.id)).toEqual([member.member.id]);

    let removed = expectOk(
      await org.clients.management.delete(`${membersPath}/${member.member.actor_id}`)
    );
    expect(removed.id).toBe(team.id);
    expect(await teamMemberIds(team.id)).toEqual([]);

    expectError(
      await org.clients.management.delete(`${membersPath}/${member.member.actor_id}`),
      400,
      'bad_request'
    );
    expectError(
      await org.clients.management.post(membersPath, { actor_id: uniqueId('oac') }),
      404,
      'not_found'
    );
  });

  it('assigns and removes team policies', async () => {
    let team = await createTeam();
    let policy = await createTeamPolicy();
    let policiesPath = `/organization/teams/${team.id}/policies`;

    let assigned = expectOk(
      await org.clients.management.post(policiesPath, { access_policy_id: policy.id })
    );
    expectPresented(assigned, 'management.team');
    expect(assigned.policies.map((item: any) => item.id)).toEqual([policy.id]);

    let again = expectOk(
      await org.clients.management.post(policiesPath, { access_policy_id: policy.slug })
    );
    expect(again.policies.map((item: any) => item.id)).toEqual([policy.id]);

    let removed = expectOk(
      await org.clients.management.delete(`${policiesPath}/${policy.id}`)
    );
    expect(removed.policies).toEqual([]);

    let removedAgain = expectOk(
      await org.clients.management.delete(`${policiesPath}/${policy.id}`)
    );
    expect(removedAgain.policies).toEqual([]);

    let defaults = (
      await listAll(org.clients.management, '/organization/access-policies')
    ).filter(item => item.type !== 'custom');
    expect(defaults.length).toBeGreaterThan(0);
    for (let defaultPolicy of defaults) {
      expectError(
        await org.clients.management.post(policiesPath, {
          access_policy_id: defaultPolicy.id
        }),
        400,
        'bad_request'
      );
    }
    expectError(
      await org.clients.management.post(policiesPath, { access_policy_id: uniqueId('apol') }),
      404,
      'not_found'
    );
  });

  it('validates team bodies', async () => {
    let team = await createTeam();

    expectError(
      await org.clients.management.post('/organization/teams', {}),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.management.post('/organization/teams', { name: 42 }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.management.post(`/organization/teams/${team.id}/members`, {}),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.management.post(`/organization/teams/${team.id}/policies`, {}),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.management.get(`/organization/teams/${uniqueId('tm')}`),
      404,
      'not_found'
    );
  });

  it('keeps teams, members and policies inside their organization', async () => {
    let team = await createTeam();
    let policy = await createTeamPolicy();
    let other = otherOrg.clients.management;
    let otherOwner = (await listAll(other, '/organization/members'))[0];
    let otherPolicy = expectOk(
      await other.post('/organization/access-policies', {
        name: uniqueId('Policy'),
        document: {
          access: [{ target: otherOrg.ids.organizationId, scopes: ['organization.team:read'] }]
        }
      })
    );

    expectError(await other.get(`/organization/teams/${team.id}`), 404, 'not_found');
    expectError(
      await other.post(`/organization/teams/${team.id}`, { name: 'Taken over' }),
      404,
      'not_found'
    );
    expectError(
      await other.post(`/organization/teams/${team.id}/members`, {
        actor_id: otherOwner.actor_id
      }),
      404,
      'not_found'
    );
    expectError(
      await other.post(`/organization/teams/${team.id}/policies`, {
        access_policy_id: policy.id
      }),
      404,
      'not_found'
    );

    expectError(
      await org.clients.management.post(`/organization/teams/${team.id}/members`, {
        actor_id: otherOwner.actor_id
      }),
      404,
      'not_found'
    );
    expectError(
      await org.clients.management.post(`/organization/teams/${team.id}/policies`, {
        access_policy_id: otherPolicy.id
      }),
      404,
      'not_found'
    );

    let theirs = await listAll(other, '/organization/teams');
    expect(theirs.map(item => item.id)).not.toContain(team.id);

    let unchanged = expectOk(
      await org.clients.management.get(`/organization/teams/${team.id}`)
    );
    expect(unchanged.name).toBe(team.name);
    expect(unchanged.policies).toEqual([]);
    expect(await teamMemberIds(team.id)).toEqual([]);
  });

  it('pages through teams', async () => {
    let created = [await createTeam(), await createTeam(), await createTeam()];

    let listed = await listAll(org.clients.management, '/organization/teams', { limit: 1 });
    let ids = listed.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(created.map(team => team.id)));
  });

  it('grants and revokes member access through team policies', async () => {
    let teamMember = await bootstrapMember(org);
    let memberClient = teamMember.clients.rest;
    let createAsMember = () =>
      memberClient.post(dashboardPath('/teams'), { name: uniqueId('Member team') });

    expectError(await createAsMember(), 403, 'forbidden');

    let team = await createTeam();
    let policy = await createTeamPolicy();
    expectOk(
      await org.clients.management.post(`/organization/teams/${team.id}/policies`, {
        access_policy_id: policy.id
      })
    );
    expectError(await createAsMember(), 403, 'forbidden');

    expectOk(
      await org.clients.management.post(`/organization/teams/${team.id}/members`, {
        actor_id: teamMember.member.actor_id
      })
    );
    let created = expectOk(await createAsMember());
    expect(created.object).toBe('management.team');
    expectOk(
      await memberClient.post(dashboardPath(`/teams/${created.id}`), {
        name: 'Renamed by member'
      })
    );
    expectError(
      await memberClient.post(dashboardPath('/access-policies'), {
        name: uniqueId('Policy'),
        document: {
          access: [{ target: org.ids.organizationId, scopes: ['organization.team:read'] }]
        }
      }),
      403,
      'forbidden'
    );

    expectOk(
      await org.clients.management.delete(
        `/organization/teams/${team.id}/policies/${policy.id}`
      )
    );
    expectError(await createAsMember(), 403, 'forbidden');
  });
});
