import {
  eventuallyAudited,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  uniqueEmail,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import {
  agentTrackingPath,
  agentTrackingSettingsPaths,
  claudeRequest,
  ingestFirstUsage
} from '@metorial/agent-tracking-e2e';
import { describe, expect, it } from 'vitest';
import { adminOnly, adminOnlyClients } from '../_agentTracking';

let defaults = {
  organization: {
    object: 'agent_tracking.organization_settings',
    service_status: 'applied',
    privacy: { hide_individuals: false, min_group_users: 5 },
    desktop: { tool_details: false }
  },
  project: {
    object: 'agent_tracking.project_settings',
    service_status: 'applied',
    retention: {
      record_days: null,
      content_days: null,
      usage_days: null,
      default_record_days: 90,
      default_content_days: 30,
      default_usage_days: 400
    }
  },
  instance: {
    object: 'agent_tracking.instance_settings',
    service_status: 'applied',
    content: { mode: 'basic' },
    classification: { deterministic_enabled: true, ai_enabled: false }
  }
};

let individualsHidden = 'agent_tracking_individuals_hidden';

describe('api-core dashboard: agent tracking settings', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);
  let limited = useMember(org);
  let projectAdmin = useMember(org);
  let organizationAdmin = useMember(org);

  let routes = () => agentTrackingSettingsPaths(org.ids);

  let objects = {
    organization: 'agent_tracking.organization_settings',
    project: 'agent_tracking.project_settings',
    instance: 'agent_tracking.instance_settings'
  };

  let read = async (level: keyof typeof objects) =>
    expectPresented(expectOk(await org.clients.rest.get(routes()[level])), objects[level]);

  let update = async (level: keyof typeof objects, body: Record<string, unknown>) =>
    expectPresented(
      expectOk(await org.clients.rest.patch(routes()[level], body)),
      objects[level]
    );

  it('answers the defaults of each level while nothing is set', async () => {
    expect(await read('organization')).toMatchObject({
      ...defaults.organization,
      organization_id: org.ids.organizationId
    });
    expect(await read('project')).toMatchObject({
      ...defaults.project,
      organization_id: org.ids.organizationId,
      project_id: org.ids.projectId
    });
    expect(await read('instance')).toMatchObject({
      ...defaults.instance,
      organization_id: org.ids.organizationId,
      project_id: org.ids.projectId,
      instance_id: org.ids.instanceId
    });
  });

  it('lets only admins read and change the settings', async () => {
    let clients = adminOnlyClients(org, member, otherOrg);
    await expectAuthMatrix(clients, client => client.get(routes().instance), adminOnly);
    await expectAuthMatrix(
      clients,
      client => client.patch(routes().instance, { content: { mode: 'basic' } }),
      adminOnly
    );

    let readable = { ...adminOnly, member: 200 };
    for (let [level, body] of [
      ['organization', { privacy: { min_group_users: 5 } }],
      ['project', { retention: { usage_days: null } }]
    ] as const) {
      await expectAuthMatrix(clients, client => client.get(routes()[level]), readable);
      await expectAuthMatrix(
        clients,
        client => client.patch(routes()[level], body),
        adminOnly
      );
    }

    let foreign = agentTrackingSettingsPaths(otherOrg.ids);
    let withoutHeader = rest(metorialEndpoints().api, { session: org.session });
    expectError(
      await withoutHeader.patch(foreign.instance, { content: { mode: 'full' } }),
      404
    );
    for (let [path, body] of [
      [foreign.organization, { privacy: { hide_individuals: true } }],
      [foreign.project, { retention: { usage_days: 30 } }]
    ] as const) {
      expectError(await withoutHeader.patch(path, body), 404);
    }
    expectError(
      await member.clients.rest.patch(routes().organization, {
        privacy: { hide_individuals: true }
      }),
      403
    );
    expectError(
      await member.clients.rest.patch(routes().project, { retention: { usage_days: 30 } }),
      403
    );
  });

  let grant = async (
    holder: { member: { actor_id: string } },
    target: string,
    scopes: string[]
  ) => {
    let policy = expectOk(
      await org.clients.management.post('/organization/access-policies', {
        name: uniqueId('Agent tracking access'),
        document: { access: [{ target, scopes }] }
      })
    );
    let team = expectOk(
      await org.clients.management.post('/organization/teams', { name: uniqueId('Team') })
    );
    expectOk(
      await org.clients.management.post(`/organization/teams/${team.id}/members`, {
        actor_id: holder.member.actor_id
      })
    );
    expectOk(
      await org.clients.management.post(`/organization/teams/${team.id}/policies`, {
        access_policy_id: policy.id
      })
    );
  };

  let agentTrackingScopes = ['instance.agent_tracking:read', 'instance.agent_tracking:write'];

  it('lets access to one instance change only that instance', async () => {
    await grant(limited, org.ids.instanceId, agentTrackingScopes);

    let client = limited.clients.rest;
    expectOk(await client.patch(routes().instance, { content: { mode: 'shape' } }));
    expectError(
      await client.patch(routes().organization, { privacy: { hide_individuals: true } }),
      403
    );
    expectError(await client.patch(routes().project, { retention: { usage_days: 30 } }), 403);

    expect(await read('organization')).toMatchObject({ privacy: { hide_individuals: false } });
    expect(await read('project')).toMatchObject({ retention: { usage_days: null } });
    expect(await read('instance')).toMatchObject({ content: { mode: 'shape' } });

    await update('instance', { content: { mode: 'basic' } });
  });

  it('checks privacy against the organization and retention against the project', async () => {
    await grant(projectAdmin, org.ids.projectId, [
      ...agentTrackingScopes,
      'organization.project:read',
      'organization.project:manage'
    ]);
    await grant(organizationAdmin, org.ids.organizationId, [
      ...agentTrackingScopes,
      'organization:read',
      'organization:write'
    ]);

    expectError(
      await projectAdmin.clients.rest.patch(routes().organization, {
        privacy: { hide_individuals: true }
      }),
      403
    );
    expectOk(
      await projectAdmin.clients.rest.patch(routes().project, {
        retention: { usage_days: 30 }
      })
    );

    expectError(
      await organizationAdmin.clients.rest.patch(routes().project, {
        retention: { usage_days: 60 }
      }),
      403
    );
    expectOk(
      await organizationAdmin.clients.rest.patch(routes().organization, {
        privacy: { min_group_users: 6 }
      })
    );

    expect(await read('organization')).toMatchObject({
      privacy: { hide_individuals: false, min_group_users: 6 }
    });
    expect(await read('project')).toMatchObject({ retention: { usage_days: 30 } });

    await update('organization', { privacy: { min_group_users: 5 } });
    await update('project', { retention: { usage_days: null } });
  });

  it('rejects values out of range', async () => {
    for (let [level, body] of [
      ['organization', { privacy: { min_group_users: 2 } }],
      ['organization', { privacy: { min_group_users: 101 } }],
      ['project', { retention: { record_days: 0 } }],
      ['project', { retention: { usage_days: 1.5 } }],
      ['instance', { content: { mode: 'everything' } }]
    ] as const) {
      expectError(await org.clients.rest.patch(routes()[level], body), 400);
    }
  });

  it('presents each change and audits who changed what, with the values before', async () => {
    let privacy = await update('organization', {
      privacy: { hide_individuals: true, min_group_users: 7 },
      desktop: { tool_details: true }
    });
    let retention = await update('project', {
      retention: { record_days: 30, usage_days: 200 }
    });
    let capture = await update('instance', {
      content: { mode: 'full' },
      classification: { ai_enabled: true }
    });

    expect(privacy).toMatchObject({
      service_status: 'applied',
      privacy: { hide_individuals: true, min_group_users: 7 },
      desktop: { tool_details: true }
    });
    expect(retention).toMatchObject({
      service_status: 'applied',
      retention: { record_days: 30, content_days: null, usage_days: 200 }
    });
    expect(capture).toMatchObject({
      service_status: 'applied',
      content: { mode: 'full' },
      classification: { deterministic_enabled: true, ai_enabled: true }
    });
    expect(await read('organization')).toMatchObject(privacy);
    expect(await read('project')).toMatchObject(retention);
    expect(await read('instance')).toMatchObject({
      ...capture,
      privacy: { hide_individuals: true, min_group_users: 7 }
    });

    expect(
      await update('organization', {
        privacy: { hide_individuals: false, min_group_users: 5 },
        desktop: { tool_details: false }
      })
    ).toMatchObject(defaults.organization);
    expect(
      await update('project', { retention: { record_days: null, usage_days: null } })
    ).toMatchObject(defaults.project);
    expect(
      await update('instance', {
        content: { mode: 'basic' },
        classification: { ai_enabled: false }
      })
    ).toMatchObject(defaults.instance);

    let owner = (await listAll(org.clients.management, '/organization/members')).find(
      (item: any) => item.user?.id === org.ids.userId || item.user_id === org.ids.userId
    );

    let entries = await eventuallyAudited(async () => {
      let body = expectOk(
        await org.clients.management.get('/organization/audit-logs', { query: { limit: 100 } })
      );
      let found = body.items.filter(
        (item: any) => item.resource == 'agent_tracking_settings' && item.action == 'update'
      );
      let restoredAll = [
        (item: any) => item.previous_attributes?.privacy?.hideIndividuals === true,
        (item: any) => item.previous_attributes?.retention?.recordDays === 30,
        (item: any) => item.previous_attributes?.content?.mode === 'full'
      ].every(restoredBy => found.some(restoredBy));
      if (!restoredAll) throw new Error('settings not audited yet');

      return found;
    });

    expect(
      entries.find((item: any) => item.payload?.privacy?.hideIndividuals === true)
    ).toMatchObject({
      organization_id: org.ids.organizationId,
      organization_actor_id: owner.actor_id,
      payload: {
        organizationId: org.ids.organizationId,
        privacy: { hideIndividuals: true, minGroupUsers: 7 }
      },
      previous_attributes: { privacy: { hideIndividuals: false, minGroupUsers: 5 } }
    });
    expect(
      entries.find((item: any) => item.payload?.retention?.recordDays === 30)
    ).toMatchObject({
      organization_actor_id: owner.actor_id,
      payload: {
        projectId: org.ids.projectId,
        retention: { recordDays: 30, contentDays: null, usageDays: 200 }
      },
      previous_attributes: { retention: { recordDays: null, usageDays: null } }
    });
    expect(entries.find((item: any) => item.payload?.content?.mode === 'full')).toMatchObject({
      organization_actor_id: owner.actor_id,
      payload: {
        instanceId: org.ids.instanceId,
        content: { mode: 'full' },
        classification: { deterministicEnabled: true, aiEnabled: true }
      },
      previous_attributes: { content: { mode: 'basic' } }
    });

    let restored = entries.find(
      (item: any) => item.previous_attributes?.privacy?.hideIndividuals === true
    );
    expect(restored).toMatchObject({
      organization_actor_id: owner.actor_id,
      previous_attributes: { privacy: { hideIndividuals: true, minGroupUsers: 7 } }
    });
  }, 180_000);
});

describe('api-core dashboard: agent tracking with individuals hidden', () => {
  let org = useOrganization();

  let get = (path: string, query: Record<string, string> = {}) =>
    org.clients.rest.get(agentTrackingPath(org, path), { query });

  let setPrivacy = async (privacy: Record<string, unknown>) =>
    expectOk(
      await org.clients.rest.patch(agentTrackingSettingsPaths(org.ids).organization, {
        privacy
      })
    );

  let refusedReads: [string, Record<string, string>][] = [
    ['/spend/breakdown', { group_by: 'member' }],
    ['/spend/breakdown', { group_by: 'model' }],
    ['/sessions', {}],
    [`/sessions/atse_${uniqueId('missing')}`, {}],
    ['/filter-values', { field: 'member' }],
    ['/filter-values', { field: 'model' }],
    ['/members', {}],
    ['/spend/timeline', { model_id: 'claude-sonnet-4-5' }],
    ['/spend/timeline', { range: 'today' }],
    ['/members/insights', {}],
    ['/spend/breakdown', { group_by: 'model', member_id: 'aten_0mhNnEqM7XQb3vXq8gD2' }],
    ['/filter-values', { field: 'seat' }]
  ];

  it('answers 403 to reads about one person, filters and today, and presents whole UTC days', async () => {
    let yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await ingestFirstUsage(org, [
      claudeRequest({
        email: uniqueEmail('agent-tracking'),
        at: new Date(`${yesterday}T12:00:00.000Z`)
      })
    ]);

    await setPrivacy({ hide_individuals: true, min_group_users: 3 });

    for (let [path, query] of refusedReads) {
      let error = expectError(await get(path, query), 403);
      expect(error.code, `${path} ${JSON.stringify(query)}`).toBe(individualsHidden);
    }

    let timeline = expectPresented(
      expectOk(
        await get('/spend/timeline', { range: 'last_7_days', time_zone: 'Asia/Tokyo' })
      ),
      'agent_tracking.spend_timeline'
    );
    expect(timeline.range.time_zone).toBe('UTC');
    expect(timeline.privacy).toEqual({
      hide_individuals: true,
      min_group_users: 3,
      hidden_groups: true
    });
    expect(timeline.items).toHaveLength(7);
    expect(timeline.items.find((item: any) => item.date == yesterday)).toMatchObject({
      hidden: true,
      cost: null,
      requests: null,
      tokens: null,
      counts: null
    });
    expect(timeline.counts).toBeNull();

    let report = expectPresented(
      expectOk(await get('/spend/report', { time_zone: 'Asia/Tokyo' })),
      'agent_tracking.spend_report'
    );
    expect(report.range.time_zone).toBe('UTC');
    expect(report.privacy).toMatchObject({ hide_individuals: true, min_group_users: 3 });
    expect(report.breakdowns).toEqual({ model: null, client: null, member: null });

    let viewsPath = (path = '') => agentTrackingPath(org, `/views${path}`);
    let view = expectPresented(
      expectOk(
        await org.clients.rest.post(viewsPath(), {
          page: 'team',
          name: uniqueId('View'),
          kind: 'practices',
          params: { version: 1, range: 'last_7_days' }
        })
      ),
      'agent_tracking.view'
    );
    expect(expectOk(await org.clients.rest.get(viewsPath(`/${view.id}`))).id).toBe(view.id);
    expect((await listAll(org.clients.rest, viewsPath())).map(item => item.id)).toContain(
      view.id
    );

    await setPrivacy({ hide_individuals: false });
    expectOk(await get('/sessions'));
  }, 240_000);
});
