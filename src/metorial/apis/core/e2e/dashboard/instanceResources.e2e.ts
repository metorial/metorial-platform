import {
  authClients,
  eventually,
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
import { usageService } from '@metorial/module-usage';
import { describe, expect, it } from 'vitest';

describe('api-core dashboard: instance resources, usage, key providers and oauth', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let instancePath = (path: string, instanceId = org.ids.instanceId) =>
    `/dashboard/instances/${instanceId}${path}`;

  let orgPath = (path: string, organizationId = org.ids.organizationId) =>
    `/dashboard/organizations/${organizationId}${path}`;

  let keyProvidersPath = (path = '', projectId = org.ids.projectId) =>
    orgPath(`/projects/${projectId}/key-providers${path}`);

  let outsider = () => rest(metorialEndpoints().api, { session: otherOrg.session });

  let timelineQuery = (entityId: string) => ({
    'entities[0][type]': 'e2e_entity',
    'entities[0][id]': entityId,
    from: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    to: new Date(Date.now() + 60 * 1000).toISOString(),
    'interval[unit]': 'hour',
    'interval[count]': 1
  });

  let totalCount = (timeline: any[]) =>
    timeline.reduce(
      (sum, series) =>
        sum + series.entries.reduce((total: number, entry: any) => total + entry.count, 0),
      0
    );

  it('counts requested resources of an instance', async () => {
    let responses = await expectAuthMatrix(
      authClients(org, { member: member.clients.rest, otherSession: outsider() }),
      client =>
        client.get(instancePath('/resource-counts'), { query: { resource: 'accounts' } }),
      {
        none: 401,
        session: 200,
        member: 200,
        management: 403,
        instance: 404,
        otherSession: 404
      }
    );

    let counts = expectPresented(responses.session.body, 'resource_counts');
    expect(counts.resources).toEqual([{ resource: 'accounts', count: 0 }]);

    let many = expectOk(
      await org.clients.rest.get(instancePath('/resource-counts'), {
        query: {
          'resource[0]': 'agents',
          'resource[1]': 'firewalls',
          'resource[2]': 'agents'
        }
      })
    );
    expect(many.resources).toEqual([
      { resource: 'agents', count: 0 },
      { resource: 'firewalls', count: 0 }
    ]);
  });

  it('validates resource count queries', async () => {
    let path = instancePath('/resource-counts');

    expectError(await org.clients.rest.get(path), 400, 'invalid_data');
    expectError(
      await org.clients.rest.get(path, { query: { resource: 'sessions' } }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.rest.get(instancePath('/resource-counts', otherOrg.ids.instanceId), {
        query: { resource: 'accounts' }
      }),
      404,
      'not_found'
    );
  });

  it("reports usage recorded for the organization's instances only", async () => {
    let entityId = uniqueId('usage-entity');
    let entity = { id: entityId, type: 'e2e_entity' };
    let owner = { id: org.ids.instanceId, type: 'instance' as const };

    await usageService.ingestUsageRecord({ owner, entity, type: 'e2e.call', count: 2 });
    await usageService.ingestUsageRecord({ owner, entity, type: 'e2e.call', count: 3 });

    await eventually(async () => {
      let usage = expectOk(
        await org.clients.rest.get(orgPath('/usage/timeline'), {
          query: timelineQuery(entityId)
        })
      );
      expectPresented(usage, 'usage');

      let series = usage.timeline.find((item: any) => item.owner_id === org.ids.instanceId);
      expect(series).toMatchObject({ entity_id: entityId, entity_type: 'e2e_entity' });
      expect(totalCount(usage.timeline)).toBe(5);
    });

    let other = expectOk(
      await otherOrg.clients.rest.get(
        orgPath('/usage/timeline', otherOrg.ids.organizationId),
        {
          query: timelineQuery(entityId)
        }
      )
    );
    expect(totalCount(other.timeline)).toBe(0);
    expect(other.timeline.map((item: any) => item.owner_id)).not.toContain(org.ids.instanceId);
  });

  it('authorizes and validates usage timeline queries', async () => {
    let query = timelineQuery(uniqueId('usage-entity'));

    await expectAuthMatrix(
      authClients(org, { member: member.clients.rest, otherSession: outsider() }),
      client => client.get(orgPath('/usage/timeline'), { query }),
      { none: 401, session: 200, member: 200, management: 403, otherSession: 404 }
    );

    let { from, ...withoutFrom } = query;
    for (let invalid of [
      withoutFrom,
      { ...query, from: 'yesterday' },
      { ...query, 'interval[unit]': 'week' },
      { ...query, 'interval[count]': 'many' }
    ]) {
      expectError(
        await org.clients.rest.get(orgPath('/usage/timeline'), { query: invalid }),
        400,
        'invalid_data'
      );
    }
  });

  it('guards key provider routes before reaching the key service', async () => {
    let clients = authClients(org, { member: member.clients.rest, otherSession: outsider() });

    await expectAuthMatrix(clients, client => client.get(keyProvidersPath()), {
      none: 401,
      management: 403,
      instance: 404,
      otherSession: 404
    });

    expectError(
      await member.clients.rest.post(keyProvidersPath(), { name: uniqueId('Key') }),
      403,
      'forbidden'
    );
    expectError(
      await member.clients.rest.post(keyProvidersPath(`/${uniqueId('kp')}/set-default`)),
      403,
      'forbidden'
    );
    expectError(
      await org.clients.rest.get(keyProvidersPath('', otherOrg.ids.projectId)),
      404,
      'not_found'
    );
    expectError(
      await org.clients.rest.post(keyProvidersPath('', otherOrg.ids.projectId), {
        name: uniqueId('Key')
      }),
      404,
      'not_found'
    );
  });

  it('validates key provider bodies', async () => {
    expectError(await org.clients.rest.post(keyProvidersPath(), {}), 400, 'invalid_data');
    expectError(
      await org.clients.rest.post(keyProvidersPath(), { name: 42 }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.rest.post(keyProvidersPath('/import'), { key_input: 'arn:aws:kms' }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.rest.get(keyProvidersPath(), { query: { limit: 0 } }),
      400,
      'invalid_data'
    );
  });

  it('only resolves oauth authorization requests for user sessions', async () => {
    let urlToken = uniqueId('oauth-url-token');
    let path = `/dashboard/oauth/authorization-requests/${urlToken}`;

    let responses = await expectAuthMatrix(authClients(org), client => client.get(path), {
      none: 401,
      session: 404,
      management: 403,
      instance: 404
    });
    expect(responses.session.body.code).toBe('not_found');

    expectError(await org.clients.rest.get(`${path}/consumer-targets`), 404, 'not_found');
    expectError(
      await org.clients.rest.post(`${path}/approve`, {
        organization_id: org.ids.organizationId
      }),
      404,
      'not_found'
    );
    expectError(await org.clients.rest.post(`${path}/reject`, {}), 404, 'not_found');
    expectError(await org.clients.management.post(`${path}/reject`, {}), 403, 'forbidden');
  });

  it('validates oauth authorization request decisions', async () => {
    let path = `/dashboard/oauth/authorization-requests/${uniqueId('oauth-url-token')}`;

    expectError(await org.clients.rest.post(`${path}/approve`, {}), 400, 'invalid_data');
    expectError(
      await org.clients.rest.post(`${path}/approve`, {
        organization_id: org.ids.organizationId,
        consumer_profile_id: 42
      }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.rest.post(`${path}/reject`, { organization_id: 42 }),
      400,
      'invalid_data'
    );
  });

  it('lists the assistants and conversations of an instance', async () => {
    let assistants = expectOk(await org.clients.rest.get(instancePath('/assistants')));
    expect(Array.isArray(assistants.items)).toBe(true);
    for (let assistant of assistants.items) expectPresented(assistant);

    let conversations = expectOk(await org.clients.rest.get(instancePath('/conversations')));
    expect(conversations.items).toEqual([]);

    expectError(
      await org.clients.rest.get(instancePath(`/assistants/${uniqueId('asst')}`)),
      404,
      'not_found'
    );
    expectError(await outsider().get(instancePath('/assistants')), 404, 'not_found');
    expectError(
      await org.clients.rest.post(instancePath('/conversations'), {}),
      400,
      'invalid_data'
    );
  });
});
