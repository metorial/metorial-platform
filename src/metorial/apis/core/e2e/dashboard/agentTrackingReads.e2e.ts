import {
  eventually,
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
  useOrganization,
  type RestQuery
} from '@metorial/e2e';
import {
  agentTrackingPath,
  claudeRequest,
  ingestFirstUsage,
  sendDesktopContext,
  serviceSessions,
  trackedConsumer
} from '@metorial/agent-tracking-e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import { adminOnly, adminOnlyClients } from '../_agentTracking';
import { db } from '@metorial/e2e/db';
import { createConsumerProfile, createPortal, ids } from '../consumer/_shared';

let minuteMs = 60 * 1000;

let madeUpModel = 'claude-e2e-unreleased-model';

let yearIn = (timeZone: string) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(new Date()));

let inOneYear = async <T>(timeZone: string, run: (year: number) => Promise<T>) => {
  for (;;) {
    let year = yearIn(timeZone);
    let result = await run(year);
    if (yearIn(timeZone) == year) return { year, result };
  }
};

describe('api-core dashboard: agent tracking reads', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let reads: [string, Record<string, string>][] = [
    ['/spend/timeline', {}],
    ['/spend/breakdown', { group_by: 'member' }],
    ['/spend/report', {}],
    ['/sessions', {}],
    ['/filter-values', { field: 'member' }],
    ['/members', {}],
    ['/members/insights', {}],
    ['/setup-status', {}]
  ];

  it('lets only admins read', async () => {
    for (let [path, query] of reads) {
      await expectAuthMatrix(
        adminOnlyClients(org, member, otherOrg),
        client => client.get(agentTrackingPath(org, path), { query }),
        adminOnly
      );
    }
  });

  it('lets only admins read one session', async () => {
    await expectAuthMatrix(
      adminOnlyClients(org, member, otherOrg),
      client => client.get(agentTrackingPath(org, `/sessions/atse_${uniqueId('missing')}`)),
      { ...adminOnly, session: 404 }
    );
  });

  it('answers 404 for an instance of another organization', async () => {
    for (let [path, query] of reads) {
      expectError(
        await org.clients.rest.get(agentTrackingPath(otherOrg, path), { query }),
        404
      );
    }
  });

  it('presents a timeline of one zero day per calendar day', async () => {
    let timeline = expectPresented(
      expectOk(
        await org.clients.rest.get(agentTrackingPath(org, '/spend/timeline'), {
          query: { range: 'last_7_days', time_zone: 'Europe/Berlin' }
        })
      ),
      'agent_tracking.spend_timeline'
    );

    expect(timeline).toMatchObject({
      range: { preset: 'last_7_days', time_zone: 'Europe/Berlin' },
      interval: 'day',
      counts: { sessions: 0, members: 0, capped: false },
      previous: { range: { preset: null, to: timeline.range.from } }
    });
    expect(timeline.items).toHaveLength(7);
    expect(timeline.items[0].cost).toMatchObject({
      currency: 'usd',
      total_micros: 0,
      list_price_micros: 0,
      is_estimate: false,
      billed_micros: null,
      requests_without_cost: 0,
      requests_without_list_price: 0
    });
  });

  it('validates ranges, groupings and filter fields', async () => {
    let timeline = (query: Record<string, string>) =>
      org.clients.rest.get(agentTrackingPath(org, '/spend/timeline'), { query });

    expectError(await timeline({ range: 'last_year' }), 400, 'invalid_data');
    expectError(await timeline({ from: '2026-11-01T00:00:00.000Z' }), 400);
    expectError(
      await timeline({ from: '2026-11-02T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' }),
      400
    );
    expectError(
      await timeline({ from: '2024-01-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' }),
      400
    );
    expectError(
      await timeline({
        range: 'today',
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-02T00:00:00.000Z'
      }),
      400
    );
    expectError(await timeline({ time_zone: 'Mars/Olympus' }), 400);

    let sessions = (query: Record<string, string>) =>
      org.clients.rest.get(agentTrackingPath(org, '/sessions'), { query });

    expectError(await sessions({ order_by: 'tokens' }), 400, 'invalid_data');
    expectError(await sessions({ range: 'last_year' }), 400, 'invalid_data');
    expectError(await sessions({ from: '2026-11-01T00:00:00.000Z' }), 400);
    expectError(
      await sessions({
        range: 'today',
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-02T00:00:00.000Z'
      }),
      400
    );

    expectError(
      await org.clients.rest.get(agentTrackingPath(org, '/spend/breakdown')),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.rest.get(agentTrackingPath(org, '/spend/breakdown'), {
        query: { group_by: 'team' }
      }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.rest.get(agentTrackingPath(org, '/filter-values'), {
        query: { field: 'repo' }
      }),
      400,
      'invalid_data'
    );

    let overLong = 'x'.repeat(201);
    for (let [path, query] of [
      ['/filter-values', { field: 'model', value: overLong }],
      ['/spend/timeline', { client_family: overLong }],
      ['/spend/breakdown', { group_by: 'model', model_id: overLong }],
      ['/sessions', { client_family: overLong }]
    ] as const) {
      expectError(
        await org.clients.rest.get(agentTrackingPath(org, path), { query }),
        400,
        'invalid_data'
      );
    }
    expectError(
      await org.clients.rest.get(agentTrackingPath(org, '/filter-values'), {
        query: { field: 'model', search: 'sonnet', value: 'claude-sonnet-4-5' }
      }),
      400
    );
  });

  it('validates member insights parameters', async () => {
    let insights = (query: RestQuery) =>
      org.clients.rest.get(agentTrackingPath(org, '/members/insights'), { query });

    let to = new Date();
    let longRange = {
      from: new Date(to.getTime() - 120 * 24 * 60 * minuteMs).toISOString(),
      to: to.toISOString()
    };

    for (let query of [
      { include: 'teams' },
      { sort: 'tokens' },
      { model_share_min: '1.5' },
      { seat_usage_max_micros: '1.5' }
    ] as RestQuery[]) {
      expectError(await insights(query), 400, 'invalid_data');
    }
    for (let query of [
      { sort: 'model_share' },
      { include: 'models' },
      { seat: 'premium' },
      { include: 'models', model_id: 'claude-sonnet-4-5', seat_usage_max_micros: '5' }
    ] as RestQuery[]) {
      expectError(await insights(query), 400, 'bad_request');
    }

    expectError(await insights({ include: 'practices', ...longRange }), 400, 'bad_request');

    expectOk(await insights(longRange));
  });

  it('presents empty member insights with organization totals', async () => {
    let insights = expectPresented(
      expectOk(
        await org.clients.rest.get(agentTrackingPath(org, '/members/insights'), {
          query: {
            include: ['models', 'practices', 'seat'],
            model_id: 'claude-sonnet-4-5',
            seat_usage_max_micros: 1000
          }
        })
      ),
      'agent_tracking.member_insights'
    );

    expect(insights).toMatchObject({
      include: ['models', 'practices', 'seat'],
      truncated: false,
      items: [],
      pagination: { has_more_after: false, has_more_before: false },
      range: { preset: 'last_30_days', time_zone: 'UTC' },
      summary: {
        cost: { currency: 'usd', total_micros: 0 },
        requests: 0,
        active_members: 0,
        members: 0,
        flag_counts: {
          model_share: null,
          high_effort: null,
          fast_mode: null,
          outdated_models: null,
          low_cache_hit_rate: null,
          low_usage_seat: 0
        },
        models: { requests: 0, cost_share: null, request_share: null },
        practices: { requests_measured: 0, high_effort_share: null, fast_share: null },
        seat: { unknown_seat_members: 0 },
        request_records_clipped: false
      }
    });
  });

  it('validates the report year, growth rate and time zone', async () => {
    let report = (query: Record<string, string>) =>
      org.clients.rest.get(agentTrackingPath(org, '/spend/report'), { query });

    let malformed: Record<string, string>[] = [
      { year: 'last' },
      { year: '2025.5' },
      { growth_rate: 'fast' },
      { growth_rate: '1.5' },
      { growth_rate: '-0.6' },
      { time_zone: 'x'.repeat(101) }
    ];
    for (let query of malformed) expectError(await report(query), 400, 'invalid_data');

    let unanswerable = await inOneYear('UTC', async year => {
      let responses: Awaited<ReturnType<typeof report>>[] = [];
      let queries: Record<string, string>[] = [
        { year: String(year + 1) },
        { year: String(year - 2) },
        { time_zone: 'Mars/Olympus' }
      ];
      for (let query of queries) responses.push(await report(query));
      return responses;
    });
    for (let response of unanswerable.result) expectError(response, 400, 'bad_request');
  });

  it('presents an empty report of this year and of last year', async () => {
    let berlin = await inOneYear(
      'Europe/Berlin',
      async () =>
        await org.clients.rest.get(agentTrackingPath(org, '/spend/report'), {
          query: { time_zone: 'Europe/Berlin', growth_rate: '0.05' }
        })
    );
    let current = expectPresented(expectOk(berlin.result), 'agent_tracking.spend_report');

    expect(current).toMatchObject({
      year: berlin.year,
      range: { preset: null, time_zone: 'Europe/Berlin' },
      counts: { sessions: 0, members: 0, capped: false },
      starts_before_retention: false,
      privacy: { hide_individuals: false, hidden_groups: false },
      coverage: {
        first_day: null,
        days_with_data: 0,
        hidden_days: 0,
        starts_before_year: false
      },
      breakdowns: { model: [], client: [], member: [] },
      projection: {
        status: 'insufficient_data',
        baseline: null,
        growth: null,
        scenarios: null
      }
    });
    expect(current.total.cost).toMatchObject({ currency: 'usd', total_micros: 0 });
    expect(current.months[0]).toMatchObject({
      month: `${current.year}-01`,
      hidden_days: 0,
      requests: 0,
      cost: { currency: 'usd', total_micros: 0, requests_without_cost: 0 },
      counts: { sessions: 0, members: 0 }
    });

    let utc = await inOneYear(
      'UTC',
      async year =>
        await org.clients.rest.get(agentTrackingPath(org, '/spend/report'), {
          query: { year: String(year - 1) }
        })
    );
    let lastYear = utc.year - 1;
    let last = expectPresented(expectOk(utc.result), 'agent_tracking.spend_report');
    expect(last.year).toBe(lastYear);
    expect(last.months).toHaveLength(12);
    expect(last.coverage.last_full_day).toBe(`${lastYear}-12-31`);
    expect(last.projection.status).toBe('not_applicable');
  });

  it('presents an empty breakdown with its total', async () => {
    for (let group_by of ['member', 'model']) {
      let breakdown = expectPresented(
        expectOk(
          await org.clients.rest.get(agentTrackingPath(org, '/spend/breakdown'), {
            query: { group_by, range: 'month_to_date' }
          })
        ),
        'agent_tracking.spend_breakdown'
      );

      expect(breakdown.group_by).toBe(group_by);
      expect(breakdown.items).toEqual([]);
      expect(breakdown.total.cost.currency).toBe('usd');
    }
  });

  it('lists no sessions for a fresh instance, with member and model filters', async () => {
    let path = agentTrackingPath(org, '/sessions');

    expect(await listAll(org.clients.rest, path, { limit: 1 })).toEqual([]);
    expect(
      await listAll(org.clients.rest, path, {
        limit: 1,
        query: { order_by: 'cost', range: 'last_30_days' }
      })
    ).toEqual([]);

    for (let member_id of ['unknown', 'aten_missing']) {
      let filtered = expectOk(
        await org.clients.rest.get(path, {
          query: { member_id, model_id: ['claude-sonnet-4-5', 'unknown'] }
        })
      );
      expect(filtered).toMatchObject({ object: 'list', items: [] });
    }
  });

  it('presents the filter values with Unknown Member', async () => {
    let values = expectPresented(
      expectOk(
        await org.clients.rest.get(agentTrackingPath(org, '/filter-values'), {
          query: { field: 'member' }
        })
      ),
      'agent_tracking.filter_values'
    );

    expect(values.items.at(-1)).toEqual({
      value: 'unknown',
      kind: 'unknown',
      member: null,
      model: null,
      client: null,
      repository: null,
      requests: null
    });
  });

  it('accepts the repository, branch and ticket groupings, fields and session filters', async () => {
    for (let group_by of ['repository', 'branch', 'ticket']) {
      let breakdown = expectOk(
        await org.clients.rest.get(agentTrackingPath(org, '/spend/breakdown'), {
          query: { group_by, range: 'month_to_date' }
        })
      );
      expect(breakdown).toMatchObject({ group_by, items: [] });
    }

    for (let field of ['repository', 'branch', 'ticket']) {
      let values = expectOk(
        await org.clients.rest.get(agentTrackingPath(org, '/filter-values'), {
          query: { field }
        })
      );
      expect(values).toMatchObject({ field, items: [] });
    }

    let filtered = expectOk(
      await org.clients.rest.get(agentTrackingPath(org, '/sessions'), {
        query: {
          repository_id: ['aten_missing', 'aten_other'],
          branch: 'main',
          ticket: 'ENG-1',
          pull_request: 'github.com/acme/api#7'
        }
      })
    );
    expect(filtered).toMatchObject({ object: 'list', items: [] });

    expectError(
      await org.clients.rest.get(agentTrackingPath(org, '/sessions'), {
        query: { branch: 'x'.repeat(201) }
      }),
      400,
      'invalid_data'
    );
    for (let ticket of ['#42', ['ENG-1', '#7']]) {
      expectError(
        await org.clients.rest.get(agentTrackingPath(org, '/sessions'), { query: { ticket } }),
        400,
        'invalid_data'
      );
    }
  });

  it('lists only members that have sent data to this instance', async () => {
    let members = await listAll(org.clients.rest, agentTrackingPath(org, '/members'), {
      limit: 1
    });
    expect(members).toEqual([]);

    let page = expectOk(await org.clients.rest.get(agentTrackingPath(org, '/members')));
    expect(page).toMatchObject({
      object: 'list',
      items: [],
      pagination: { has_more_after: false, has_more_before: false }
    });

    expectError(
      await org.clients.rest.get(agentTrackingPath(org, '/members'), {
        query: { after: 'aten_missing' }
      }),
      400
    );
  });

  it('presents the setup status', async () => {
    let status = expectPresented(
      expectOk(await org.clients.rest.get(agentTrackingPath(org, '/setup-status'))),
      'agent_tracking.setup_status'
    );

    expect(status).toMatchObject({
      last_received_at: null,
      options: { usage_and_cost: 'not_detected', keep_local_history: 'undetectable' }
    });
  });
});

describe('api-core dashboard: agent tracking reads of ingested usage', () => {
  let org = useOrganization();

  let sessionsPath = () => agentTrackingPath(org, '/sessions');

  let read = async (path: string, query: RestQuery = {}) =>
    expectOk(await org.clients.rest.get(agentTrackingPath(org, path), { query }));

  let emails = {
    matched: uniqueEmail('agent-tracking'),
    other: uniqueEmail('agent-tracking')
  };

  let seededAt: Date[] = [];

  beforeAll(async () => {
    let portal = await createPortal(org);
    let profile = await createConsumerProfile(org, portal.id, { email: emails.matched });
    let { consumer } = await db.consumerProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: { consumer: true }
    });
    await eventually(() => trackedConsumer(org.ids, consumer.id), {
      timeoutMs: 60_000,
      intervalMs: 500
    });

    let now = Date.now();
    let sessions = [uniqueId('session'), uniqueId('session'), uniqueId('session')];

    let requests = [
      claudeRequest({
        sessionId: sessions[0],
        email: emails.matched,
        at: new Date(now - 20 * minuteMs)
      }),
      claudeRequest({
        sessionId: sessions[0],
        email: emails.matched,
        at: new Date(now - 19 * minuteMs)
      }),
      claudeRequest({
        sessionId: sessions[1],
        email: emails.other,
        at: new Date(now - 15 * minuteMs),
        costUsd: 0.002
      }),
      claudeRequest({
        sessionId: sessions[2],
        at: new Date(now - 10 * minuteMs),
        model: madeUpModel,
        costUsd: 0.001
      })
    ];
    seededAt = requests.map(request => request.at);

    await ingestFirstUsage(org, requests);
  }, 240_000);

  it('presents sessions with member, client, tokens and cost', async () => {
    let sessions = await listAll(org.clients.rest, sessionsPath());
    expect(sessions.map(session => session.requests)).toEqual([1, 1, 2]);

    for (let session of sessions) {
      expectPresented(session, 'agent_tracking.session');
      expect(session.id.startsWith('atse_')).toBe(true);
      expect(session.client).toMatchObject({ family: 'claude_code', name: 'Claude Code' });
    }

    expect(sessions[2]).toMatchObject({
      tokens: { input: 2000, cache_read: 6000, cache_write: 800, output: 400, total: 9200 },
      cost: { currency: 'usd', total_micros: 25000, reported_by_client_micros: 25000 },
      member: { matched: true, email: emails.matched, consumer: { email: emails.matched } }
    });
    expect(sessions[1].member).toMatchObject({ matched: false, consumer: null });
    expect(sessions[0]).toMatchObject({
      member: null,
      models: [],
      unknown_model_names: [madeUpModel],
      billing_modes: ['unknown'],
      summary_pending: false
    });
    let lastActivity = new Date(sessions[0].last_activity_at).getTime();
    expect(new Date(sessions[0].started_at).getTime()).toBeLessThanOrEqual(lastActivity);
    expect(lastActivity).toBeLessThanOrEqual(Date.now());
    expect(sessions[0].last_activity_at).toBe(new Date(lastActivity).toISOString());
  });

  it('refuses machine keys on the session routes', async () => {
    let [session] = await listAll(org.clients.rest, sessionsPath());
    let instanceKey = rest(metorialEndpoints().api, { apiKey: org.keys.instanceSecret });
    let managementPath = `/instances/${org.ids.instanceId}/agent-tracking/sessions`;

    for (let response of [
      await instanceKey.get('/agent-tracking/sessions'),
      await instanceKey.get(`/agent-tracking/sessions/${session.id}`),
      await org.clients.management.get(managementPath),
      await org.clients.management.get(`${managementPath}/${session.id}`)
    ]) {
      let error = expectError(response, 403, 'forbidden');
      expect(error.message).toBe('This endpoint is only for the dashboard for now.');
      expect(response.text).not.toMatch(/member|cost|requests/);
    }

    for (let path of ['/agent-tracking/sessions', `/agent-tracking/sessions/${session.id}`]) {
      let response = await org.clients.instance.get(path);
      expect(expectError(response, 404, 'not_found').entity).toBe('endpoint');
    }
  });

  it('pages sessions by item id in both directions', async () => {
    let all = ids(await listAll(org.clients.rest, sessionsPath(), { limit: 1 }));
    expect(all).toHaveLength(3);
    expect(new Set(all).size).toBe(3);

    let [first, second, third] = all;

    let next = await read('/sessions', { limit: 1, after: first! });
    expect(ids(next.items)).toEqual([second]);
    expect(next.pagination).toMatchObject({ has_more_after: true, has_more_before: true });

    let back = await read('/sessions', { limit: 1, before: second! });
    expect(ids(back.items)).toEqual([first]);
    expect(back.pagination).toMatchObject({ has_more_after: true, has_more_before: false });

    let rest = await read('/sessions', { limit: 2, after: first! });
    expect(ids(rest.items)).toEqual([second, third]);
    expect(rest.pagination).toMatchObject({ has_more_after: false, has_more_before: true });

    expectError(
      await org.clients.rest.get(sessionsPath(), {
        query: { after: `atse_${uniqueId('missing')}` }
      }),
      400
    );
  });

  it('pages sessions ordered by cost by item id in both directions', async () => {
    let paged = ids(
      await listAll(org.clients.rest, sessionsPath(), {
        limit: 1,
        query: { order_by: 'cost', range: 'last_7_days' }
      })
    );
    expect(paged).toHaveLength(3);

    let [first, second, third] = paged;

    let next = await read('/sessions', { order_by: 'cost', limit: 1, after: first! });
    expect(ids(next.items)).toEqual([second]);
    expect(next.pagination).toMatchObject({ has_more_after: true, has_more_before: true });

    let back = await read('/sessions', { order_by: 'cost', limit: 1, before: third! });
    expect(ids(back.items)).toEqual([second]);

    let cheapest = await read('/sessions', { order_by: 'cost', order: 'asc', limit: 2 });
    expect(ids(cheapest.items)).toEqual([third, second]);
  });

  it('accepts repeated filter values', async () => {
    let sessions = await listAll(org.clients.rest, sessionsPath());

    let filtered = await listAll(org.clients.rest, sessionsPath(), {
      query: { member_id: [sessions[2].member.id, 'unknown'] }
    });
    expect(ids(filtered).sort()).toEqual(ids([sessions[0], sessions[2]]).sort());

    let timeline = await read('/spend/timeline', {
      range: 'last_7_days',
      client_family: ['claude_code', 'cursor']
    });
    expect(timeline.total.requests).toBe(4);
  });

  it('presents one session with its usage per model', async () => {
    let [row] = await listAll(org.clients.rest, sessionsPath());

    let session = expectPresented(
      await read(`/sessions/${row.id}`),
      'agent_tracking.session_detail'
    );
    expect(session).toMatchObject({ id: row.id, requests: 1, cost: row.cost });
    expect(session.usage_by_model).toHaveLength(1);
    expect(session.usage_by_model[0]).toMatchObject({
      share: 1,
      requests: 1,
      cost: { currency: 'usd', total_micros: 1000, is_estimate: true }
    });
    expect(session.context).toEqual({
      repositories: [],
      branch: null,
      default_branch: null,
      head: null,
      worktree: null,
      sub_path: null,
      permission_mode: null,
      title: null,
      tickets: [],
      pull_requests: [],
      commit_count: 0,
      pull_request_count: 0,
      lines: { added: 0, removed: 0 }
    });
    expect(session.commits).toEqual([]);

    expectError(
      await org.clients.rest.get(agentTrackingPath(org, `/sessions/atse_${uniqueId('x')}`)),
      404
    );
    expectError(
      await org.clients.rest.get(agentTrackingPath(org, `/sessions/${uniqueId('ses')}`)),
      404
    );
  });

  it('answers 404 for a session of another instance of the same organization', async () => {
    let sessions = await listAll(org.clients.rest, sessionsPath());
    let base = `/dashboard/organizations/${org.ids.organizationId}`;
    let project = expectOk(
      await org.clients.rest.post(`${base}/projects`, { name: uniqueId('Other Project') })
    );
    let instances = expectOk(
      await org.clients.rest.get(`${base}/instances`, { query: { project_id: project.id } })
    );
    let otherInstanceId = instances.items[0].id;
    expect(otherInstanceId).not.toBe(org.ids.instanceId);

    for (let session of sessions) {
      expectOk(await org.clients.rest.get(agentTrackingPath(org, `/sessions/${session.id}`)));
      expectError(
        await org.clients.rest.get(
          agentTrackingPath(otherInstanceId, `/sessions/${session.id}`)
        ),
        404
      );
    }
    expect(
      await listAll(org.clients.rest, agentTrackingPath(otherInstanceId, '/sessions'))
    ).toEqual([]);
  });

  it('presents the spend timeline and breakdowns with their totals', async () => {
    let timeline = expectPresented(
      await read('/spend/timeline', { range: 'last_7_days' }),
      'agent_tracking.spend_timeline'
    );
    expect(timeline).toMatchObject({
      counts: { sessions: 3, members: 2, capped: false },
      previous: { starts_before_retention: false, hidden_groups: false },
      privacy: { hide_individuals: false, hidden_groups: false },
      total: {
        requests: 4,
        cost: { currency: 'usd', total_micros: 28000, requests_without_cost: 0 },
        tokens: { input: 4000, cache_read: 12000, cache_write: 1600, output: 800 }
      }
    });

    let members = expectPresented(
      await read('/spend/breakdown', { group_by: 'member', range: 'last_7_days' }),
      'agent_tracking.spend_breakdown'
    );
    expect(members.items.map((item: any) => [item.kind, item.requests])).toEqual([
      ['member', 2],
      ['member', 1],
      ['unknown', 1]
    ]);
    expect(members.items[0]).toMatchObject({
      member: { email: emails.matched, consumer: { email: emails.matched } },
      cost: { total_micros: 25000 }
    });
    expect(members.items[0].share).toBeCloseTo(0.025 / 0.028, 6);
    expect(members.items[1].share).toBeCloseTo(0.002 / 0.028, 6);
    expect(members.items[2].share).toBeCloseTo(0.001 / 0.028, 6);

    let models = expectPresented(
      await read('/spend/breakdown', { group_by: 'model', range: 'last_7_days' }),
      'agent_tracking.spend_breakdown'
    );
    let unknown = models.items.find((item: any) => item.kind == 'unknown');
    expect(unknown).toMatchObject({ key: 'unknown', member: null, model: null });
    expect(unknown.unknown_model_names).toContain(madeUpModel);
    expect(models.items.reduce((sum: number, item: any) => sum + item.requests, 0)).toBe(4);
    for (let item of models.items.filter((item: any) => item.kind == 'model')) {
      expect(item).toMatchObject({ key: item.model.id, unknown_model_names: [] });
    }
  });

  it('presents the spend report with its lists by model, client and member', async () => {
    let report = expectPresented(await read('/spend/report'), 'agent_tracking.spend_report');
    expect(report.projection).toMatchObject({ status: 'insufficient_data', scenarios: null });
    if (seededAt.some(at => at.getUTCFullYear() != report.year)) return;

    expect(report.total).toMatchObject({
      requests: 4,
      cost: { currency: 'usd', total_micros: 28000 }
    });
    expect(report.coverage.first_day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(report.coverage.days_with_data).toBeGreaterThanOrEqual(1);
    expect(report.coverage.hidden_days).toBe(0);
    expect(
      report.months.reduce((sum: number, month: any) => sum + month.cost.total_micros, 0)
    ).toBe(28000);

    expect(report.breakdowns.client).toEqual([
      expect.objectContaining({
        kind: 'client',
        key: 'claude_code',
        client: { family: 'claude_code', name: 'Claude Code' },
        member: null,
        model: null,
        share: 1,
        requests: 4
      })
    ]);
    expect(report.breakdowns.member.map((item: any) => [item.kind, item.requests])).toEqual([
      ['member', 2],
      ['member', 1],
      ['unknown', 1]
    ]);
    expect(report.breakdowns.member[0]).toMatchObject({
      member: { email: emails.matched, consumer: { email: emails.matched } },
      client: null
    });

    let unknown = report.breakdowns.model.find((item: any) => item.kind == 'unknown');
    expect(unknown.unknown_model_names).toContain(madeUpModel);
  });

  it('presents the client filter values', async () => {
    let clients = expectPresented(
      await read('/filter-values', { field: 'client', range: 'last_7_days' }),
      'agent_tracking.filter_values'
    );
    expect(clients.items).toEqual([
      {
        value: 'claude_code',
        kind: 'client',
        member: null,
        model: null,
        client: { family: 'claude_code', name: 'Claude Code' },
        requests: 4
      }
    ]);
  });

  it('lists the members who sent usage', async () => {
    let members = await listAll(org.clients.rest, agentTrackingPath(org, '/members'), {
      limit: 1
    });

    expect(members.map(member => member.email)).toEqual([emails.other, emails.matched]);
    expect(members[0]).toMatchObject({
      object: 'agent_tracking.member',
      matched: false,
      consumer: null,
      sessions: 1
    });
    expect(members[1]).toMatchObject({
      matched: true,
      consumer: { email: emails.matched },
      sessions: 1
    });
    for (let member of members) expect(member.last_seen_at).not.toBeNull();

    let [newest, oldest] = ids(members);

    let next = await read('/members', { limit: 1, after: newest! });
    expect(ids(next.items)).toEqual([oldest]);
    expect(next).toMatchObject({
      items: [{ list_truncated: false }],
      pagination: { has_more_after: false, has_more_before: true }
    });

    let back = await read('/members', { limit: 1, before: oldest! });
    expect(ids(back.items)).toEqual([newest]);
    expect(back.pagination).toMatchObject({ has_more_after: true, has_more_before: false });
  });

  it('counts the sessions and cost of a member in a range', async () => {
    let [member] = await listAll(org.clients.rest, agentTrackingPath(org, '/members'));
    let sessions = await listAll(org.clients.rest, sessionsPath(), {
      query: { member_id: member.id }
    });
    let sessionCost = sessions.reduce((sum, session) => sum + session.cost.total_micros, 0);

    let inRange = await read('/members', {
      member_id: member.id,
      range: 'last_7_days',
      time_zone: 'Europe/Berlin'
    });
    expect(ids(inRange.items)).toEqual([member.id]);
    expect(inRange.items[0]).toMatchObject({
      sessions: sessions.length,
      cost: { currency: 'usd' }
    });
    expect(Math.abs(inRange.items[0].cost.total_micros - sessionCost)).toBeLessThanOrEqual(
      sessions.length
    );

    let lastMonth = await read('/members', { member_id: member.id, range: 'last_month' });
    expect(lastMonth.items).toEqual([]);
  });
});

describe('api-core dashboard: agent tracking member insights', () => {
  let org = useOrganization();

  let read = async (path: string, query: RestQuery = {}) =>
    expectOk(await org.clients.rest.get(agentTrackingPath(org, path), { query }));

  let emails = {
    sonnet: uniqueEmail('agent-tracking'),
    haiku: uniqueEmail('agent-tracking'),
    idle: uniqueEmail('agent-tracking')
  };

  let byEmail = (items: any[]) =>
    Object.fromEntries(items.map(item => [item.member.email, item]));

  beforeAll(async () => {
    let portal = await createPortal(org);
    let profile = await createConsumerProfile(org, portal.id, { email: emails.idle });
    let { consumer } = await db.consumerProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: { consumer: true }
    });
    await eventually(() => trackedConsumer(org.ids, consumer.id), {
      timeoutMs: 60_000,
      intervalMs: 500
    });

    let now = Date.now();
    await ingestFirstUsage(org, [
      claudeRequest({ email: emails.sonnet, at: new Date(now - 20 * minuteMs) }),
      claudeRequest({ email: emails.sonnet, at: new Date(now - 19 * minuteMs) }),
      claudeRequest({
        email: emails.haiku,
        at: new Date(now - 15 * minuteMs),
        model: 'claude-haiku-4-5-20251001',
        costUsd: 0.002
      })
    ]);
  }, 240_000);

  it('presents the members ranked by cost', async () => {
    let insights = expectPresented(
      await read('/members/insights'),
      'agent_tracking.member_insights'
    );

    expect(insights.items.map((item: any) => [item.member.email, item.rank])).toEqual([
      [emails.sonnet, 1],
      [emails.haiku, 2]
    ]);
    expect(insights.items[0]).toMatchObject({
      member: { object: 'agent_tracking.member' },
      cost: { currency: 'usd' },
      models: null,
      practices: null,
      seat: null,
      flags: []
    });
  });

  it('pages member insights by item id and keeps the rank', async () => {
    let first = await read('/members/insights', { limit: 1 });
    expect(first.items.map((item: any) => item.rank)).toEqual([1]);
    expect(first.pagination.has_more_after).toBe(true);

    let second = await read('/members/insights', {
      limit: 1,
      after: first.items[0].member.id
    });
    expect(second.items.map((item: any) => [item.member.email, item.rank])).toEqual([
      [emails.haiku, 2]
    ]);

    let ascending = await read('/members/insights', { order: 'asc' });
    expect(ascending.items.map((item: any) => item.member.email)).toEqual([
      emails.haiku,
      emails.sonnet
    ]);
  });

  it('lists a member without usage only with include_inactive', async () => {
    let inactive = await read('/members/insights', { include_inactive: true });
    expect(byEmail(inactive.items)[emails.idle]).toBeDefined();

    let active = await read('/members/insights');
    expect(byEmail(active.items)[emails.idle]).toBeUndefined();
  });
});

describe('api-core dashboard: agent tracking session context', () => {
  let org = useOrganization();

  let sessionsPath = () => agentTrackingPath(org, '/sessions');

  let read = async (path: string, query: RestQuery = {}) =>
    expectOk(await org.clients.rest.get(agentTrackingPath(org, path), { query }));

  beforeAll(async () => {
    let now = Date.now();
    let sessionId = uniqueId('session');

    let source = await ingestFirstUsage(org, [
      claudeRequest({ sessionId, at: new Date(now - 10 * minuteMs) }),
      claudeRequest({ sessionId: uniqueId('session'), at: new Date(now - 5 * minuteMs) })
    ]);

    await sendDesktopContext({ ids: org.ids, ingestUrl: source.ingest_url }, sessionId, {
      remoteUrl: 'git@github.com:acme/api.git',
      branch: 'ada/eng-12-login',
      ticketRefs: ['ENG-9'],
      pullRequest: { provider: 'github', repository: 'acme/api', number: 7 }
    });

    await eventually(
      async () => {
        let reported = (await serviceSessions(org.ids)).find(
          session => session.context.branch == 'ada/eng-12-login'
        );
        expect(reported?.summary?.pullRequestRefs).toHaveLength(1);
      },
      { timeoutMs: 120_000, intervalMs: 1_000 }
    );
  }, 300_000);

  it('presents the context of a session in snake case', async () => {
    let [session] = await listAll(org.clients.rest, sessionsPath(), {
      query: { branch: 'ada/eng-12-login' }
    });

    expectPresented(session, 'agent_tracking.session');
    expect(session.context).toMatchObject({
      repositories: [
        {
          provider: 'github.com',
          owner: 'acme',
          name: 'api',
          url: 'https://github.com/acme/api'
        }
      ],
      branch: 'ada/eng-12-login',
      default_branch: 'main',
      sub_path: 'services/api',
      pull_requests: [
        {
          key: 'github.com/acme/api#7',
          provider: 'github.com',
          repository: 'acme/api',
          number: 7,
          kind: 'opened',
          url: 'https://github.com/acme/api/pull/7'
        }
      ],
      commit_count: 1,
      pull_request_count: 1,
      lines: { added: 12, removed: 3 }
    });
    expect(session).not.toHaveProperty('commits');

    let detail = expectPresented(
      await read(`/sessions/${session.id}`),
      'agent_tracking.session_detail'
    );
    expect(detail.commits).toEqual([
      expect.objectContaining({
        sha: 'c'.repeat(40),
        committed_at: expect.any(String),
        branch: null,
        tickets: [{ key: 'ENG-9', url: null }],
        ai_authored: true
      })
    ]);
  });

  it('filters sessions by repository, ticket and pull request', async () => {
    let [session] = await listAll(org.clients.rest, sessionsPath(), {
      query: { branch: 'ada/eng-12-login' }
    });

    for (let query of [
      { repository_id: session.context.repositories[0].id },
      { ticket: ['eng-12', 'OPS-1'] },
      { pull_request: 'github.com/acme/api#7' }
    ]) {
      expect(ids(await listAll(org.clients.rest, sessionsPath(), { query }))).toEqual([
        session.id
      ]);
    }
  });

  it('breaks spend down by ticket and lists repositories as filter values', async () => {
    let byTicket = await read('/spend/breakdown', {
      group_by: 'ticket',
      range: 'last_7_days'
    });
    expect(
      byTicket.items
        .filter((item: any) => item.kind == 'ticket')
        .map((item: any) => item.key)
        .sort()
    ).toEqual(['ENG-12', 'ENG-9']);

    let byRepository = await read('/spend/breakdown', {
      group_by: 'repository',
      range: 'last_7_days'
    });
    expect(byRepository.items.find((item: any) => item.kind == 'repository')).toMatchObject({
      repository: { owner: 'acme', name: 'api' }
    });

    let values = await read('/filter-values', { field: 'repository', search: 'acme' });
    expect(values.items).toEqual([
      expect.objectContaining({
        kind: 'repository',
        repository: expect.objectContaining({ name: 'api' })
      })
    ]);
  });
});
