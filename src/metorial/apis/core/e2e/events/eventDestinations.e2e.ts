import { createHmac } from 'node:crypto';
import {
  authClients,
  eventually,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  type RestClient,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';

let unresolvableUrl = () => `https://${uniqueId('hook')}.invalid/webhooks`;

let headerValue = (headers: { key: string; value: string }[], key: string) =>
  headers.find(header => header.key === key)?.value;

describe('api-core management: event destinations', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let dashboardPath = (path: string) =>
    `/dashboard/organizations/${org.ids.organizationId}${path}`;

  let createDestination = async (
    body: Record<string, unknown> = {},
    client: RestClient = org.clients.management
  ) =>
    expectOk(
      await client.post('/organization/event-destinations', {
        name: uniqueId('rest-destination'),
        type: 'webhook',
        webhook: { url: `https://example.com/webhooks/${uniqueId('hook')}` },
        ...body
      })
    );

  let createListener = async (destinationId: string, body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.management.post('/organization/event-destination-listeners', {
        instance_id: org.ids.instanceId,
        event_destination_id: destinationId,
        type: 'event',
        event_types: ['organization.created'],
        ...body
      })
    );

  it('authenticates event destination routes per credential', async () => {
    let clients = authClients(org, {
      member: member.clients.rest,
      otherSession: rest(metorialEndpoints().api, { session: otherOrg.session }),
      instanceDefaultVersion: rest(metorialEndpoints().api, {
        apiKey: org.keys.instanceSecret
      })
    });
    let isDashboard = (name: string) =>
      name === 'session' || name === 'member' || name === 'otherSession';
    let path = (name: string) =>
      isDashboard(name)
        ? dashboardPath('/event-destinations')
        : '/organization/event-destinations';

    await expectAuthMatrix(clients, (client, name) => client.get(path(name)), {
      none: 401,
      session: 200,
      management: 200,
      instance: 403,
      instanceDefaultVersion: 403,
      member: 200,
      otherSession: 404
    });

    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.post(path(name), {
          name: uniqueId('matrix'),
          type: 'webhook',
          webhook: { url: `https://example.com/webhooks/${uniqueId('hook')}` }
        }),
      { none: 401, session: 200, management: 200, member: 403, otherSession: 404 }
    );

    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(
          isDashboard(name)
            ? dashboardPath('/event-deliveries')
            : '/organization/event-deliveries'
        ),
      { none: 401, session: 200, management: 200, member: 200, otherSession: 404 }
    );
  });

  it('reveals the signing secret only when it is created or rotated', async () => {
    let url = `https://example.com/webhooks/${uniqueId('hook')}`;
    let created = await createDestination({
      description: 'Secret exposure',
      webhook: { url }
    });

    expectPresented(created, 'event.destination');
    expect(created).toMatchObject({
      organization_id: org.ids.organizationId,
      description: 'Secret exposure',
      status: 'active',
      type: 'webhook',
      listeners: [],
      archived_at: null
    });
    expect(created.webhook).toMatchObject({ url, method: 'POST' });
    expect(created.webhook.signing_secret).toMatch(/^metorial_whsec_/);

    let stored = await db.eventDestination.findUniqueOrThrow({
      where: { id: created.id },
      include: { webhookDestination: true }
    });
    expect(stored.webhookDestination!.signingSecret).toBe(created.webhook.signing_secret);

    let management = org.clients.management;
    let fetched = expectOk(
      await management.get(`/organization/event-destinations/${created.id}`)
    );
    expect(fetched.webhook.signing_secret).toBeNull();

    let listed = await listAll(management, '/organization/event-destinations');
    expect(listed.find(item => item.id === created.id)!.webhook.signing_secret).toBeNull();

    let dashboard = expectOk(
      await org.clients.rest.get(dashboardPath(`/event-destinations/${created.id}`))
    );
    expect(dashboard.webhook.signing_secret).toBeNull();

    let updated = expectOk(
      await management.patch(`/organization/event-destinations/${created.id}`, {
        name: `${created.name}-renamed`
      })
    );
    expect(updated.name).toBe(`${created.name}-renamed`);
    expect(updated.webhook.signing_secret).toBeNull();

    let rotated = expectOk(
      await management.post(
        `/organization/event-destinations/${created.id}/rotate-webhook-secret`
      )
    );
    expectPresented(rotated, 'event.destination');
    expect(rotated.webhook.signing_secret).toMatch(/^metorial_whsec_/);
    expect(rotated.webhook.signing_secret).not.toBe(created.webhook.signing_secret);

    let afterRotation = expectOk(
      await management.get(`/organization/event-destinations/${created.id}`)
    );
    expect(afterRotation.webhook.signing_secret).toBeNull();

    let archived = expectOk(
      await management.post(`/organization/event-destinations/${created.id}/archive`)
    );
    expect(archived.status).toBe('archived');
    expect(archived.archived_at).toEqual(expect.any(String));
    expect(archived.webhook.signing_secret).toBeNull();
  });

  it('records a signing-secret rotation in the audit log without the secret', async () => {
    let created = await createDestination();
    let rotated = expectOk(
      await org.clients.management.post(
        `/organization/event-destinations/${created.id}/rotate-webhook-secret`
      )
    );

    let entry = await eventually(
      async () => {
        let auditLogs = await listAll(org.clients.management, '/organization/audit-logs');
        let entry = auditLogs.find(
          item =>
            item.resource == 'event_destination' &&
            item.action == 'rotate_secret' &&
            item.payload?.id == created.id
        );
        expect(entry).toBeDefined();
        return entry!;
      },
      { timeoutMs: 150_000, intervalMs: 2_000 }
    );

    expect(entry.payload).toMatchObject({ id: created.id, name: created.name });
    let stored = JSON.stringify(entry);
    expect(stored).not.toContain(created.webhook.signing_secret);
    expect(stored).not.toContain(rotated.webhook.signing_secret);
  }, 180_000);

  it('presents the retry policy of destinations and deliveries', async () => {
    let retry = {
      strategy: 'fixed',
      max_attempts: 1,
      base_delay_seconds: 5,
      max_delay_seconds: 60
    };
    let created = await createDestination({ webhook: { url: unresolvableUrl() }, retry });
    expect(created.retry).toEqual(retry);

    let delivery = expectOk(
      await org.clients.management.post(`/organization/event-destinations/${created.id}/ping`)
    );
    expect(delivery.retry).toEqual(retry);
  });

  it('validates event destination bodies and queries', async () => {
    let management = org.clients.management;
    let create = (body: Record<string, unknown>) =>
      management.post('/organization/event-destinations', {
        name: uniqueId('invalid'),
        type: 'webhook',
        webhook: { url: 'https://example.com/hook' },
        ...body
      });

    expectError(
      await management.post('/organization/event-destinations', {}),
      400,
      'invalid_data'
    );
    expectError(await create({ type: 'email' }), 400, 'invalid_data');
    expectError(await create({ webhook: undefined }), 400, 'invalid_data');
    expectError(await create({ webhook: { url: 'not a url' } }), 400, 'invalid_data');
    expectError(await create({ retry: { strategy: 'random' } }), 400, 'invalid_data');
    expectError(await create({ retry: { max_attempts: 0 } }), 400, 'bad_request');
    expectError(await create({ retry: { max_attempts: 26 } }), 400, 'bad_request');
    expectError(
      await create({ webhook: { url: 'http://127.0.0.1/hook' } }),
      400,
      'bad_request'
    );
    expectError(
      await create({ webhook: { url: 'http://169.254.169.254/latest/meta-data/' } }),
      400,
      'bad_request'
    );
    expectError(await create({ webhook: { url: 'http://[::1]/hook' } }), 400);

    let destination = await createDestination();
    expectError(
      await management.patch(`/organization/event-destinations/${destination.id}`, {
        webhook: { url: 'http://10.0.0.1/hook' }
      }),
      400,
      'bad_request'
    );
    expect(
      expectOk(await management.get(`/organization/event-destinations/${destination.id}`))
        .webhook.url
    ).toBe(destination.webhook.url);

    expectError(
      await management.get('/organization/event-destinations', {
        query: { status: 'deleted' }
      }),
      400,
      'invalid_data'
    );
    expectError(
      await management.get('/organization/event-destinations', { query: { limit: 0 } }),
      400,
      'invalid_data'
    );
    expectError(
      await management.get('/organization/event-deliveries', { query: { status: 'lost' } }),
      400,
      'invalid_data'
    );
  });

  it('pages through destinations and filters them by status', async () => {
    let created = [
      await createDestination(),
      await createDestination(),
      await createDestination()
    ];
    let archived = await createDestination();
    expectOk(
      await org.clients.management.post(
        `/organization/event-destinations/${archived.id}/archive`
      )
    );

    let listed = await listAll(org.clients.management, '/organization/event-destinations', {
      limit: 1
    });
    let ids = listed.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(created.map(item => item.id)));
    expect(ids).not.toContain(archived.id);
    for (let item of listed) expectPresented(item, 'event.destination');

    let archivedIds = (
      await listAll(org.clients.management, '/organization/event-destinations', {
        query: { status: 'archived' }
      })
    ).map(item => item.id);
    expect(archivedIds).toContain(archived.id);
    expect(archivedIds).not.toContain(created[0]!.id);
  });

  it('manages listeners and validates their event types', async () => {
    let management = org.clients.management;
    let destination = await createDestination();

    let listener = await createListener(destination.id);
    expectPresented(listener, 'event.destination_listener');
    expect(listener).toMatchObject({
      instance_id: org.ids.instanceId,
      event_destination_id: destination.id,
      type: 'event',
      event_types: ['organization.created'],
      callback_id: null,
      triggers: null,
      chat_connection_id: null,
      provider_id: null
    });

    let withListener = expectOk(
      await management.get(`/organization/event-destinations/${destination.id}`)
    );
    expect(withListener.listeners.map((item: any) => item.id)).toEqual([listener.id]);

    let listed = await listAll(management, '/organization/event-destination-listeners', {
      query: { event_destination_id: destination.id }
    });
    expect(listed.map(item => item.id)).toEqual([listener.id]);

    let updated = expectOk(
      await management.patch(`/organization/event-destination-listeners/${listener.id}`, {
        event_types: []
      })
    );
    expect(updated.event_types).toEqual([]);

    expectError(
      await management.post('/organization/event-destination-listeners', {
        instance_id: org.ids.instanceId,
        event_destination_id: destination.id,
        type: 'event',
        event_types: ['e2e.not_a_real_event']
      }),
      400,
      'bad_request'
    );
    expectError(
      await management.post('/organization/event-destination-listeners', {
        instance_id: org.ids.instanceId,
        event_destination_id: destination.id,
        type: 'event'
      }),
      400,
      'invalid_data'
    );
    expectError(
      await management.post('/organization/event-destination-listeners', {
        instance_id: org.ids.instanceId,
        event_destination_id: destination.id,
        type: 'webhook',
        event_types: ['organization.created']
      }),
      400,
      'invalid_data'
    );

    let deleted = expectOk(
      await management.delete(`/organization/event-destination-listeners/${listener.id}`)
    );
    expect(deleted.id).toBe(listener.id);
    expectError(
      await management.get(`/organization/event-destination-listeners/${listener.id}`),
      404,
      'not_found'
    );
  });

  it('pings a destination and exposes the signed attempt through deliveries and attempts', async () => {
    let management = org.clients.management;
    let destination = await createDestination({
      webhook: { url: unresolvableUrl() },
      retry: { strategy: 'fixed', max_attempts: 1 }
    });
    let signingSecret = destination.webhook.signing_secret as string;

    let ping = expectOk(
      await management.post(`/organization/event-destinations/${destination.id}/ping`)
    );
    expectPresented(ping, 'event.delivery');
    expect(ping).toMatchObject({
      organization_id: org.ids.organizationId,
      instance_id: null,
      event_type: 'ping',
      event_destination_id: destination.id,
      type: 'webhook',
      status: 'pending',
      attempt_count: 0,
      attempts: []
    });

    let failed = await eventually(
      async () => {
        let delivery = expectOk(
          await management.get(`/organization/event-deliveries/${ping.id}`)
        );
        expect(delivery).toMatchObject({ status: 'failed', attempt_count: 1 });
        return delivery;
      },
      { timeoutMs: 60_000, intervalMs: 500 }
    );
    expectPresented(failed, 'event.delivery');
    expect(failed.error.code).toBe('request_failed');
    expect(failed.completed_at).toEqual(expect.any(String));

    let attempts = await listAll(management, '/organization/event-delivery-attempts', {
      query: { event_delivery_id: ping.id }
    });
    expect(attempts).toHaveLength(1);
    expectPresented(attempts[0], 'event.delivery_attempt');
    expect(attempts[0]).toMatchObject({
      event_delivery_id: ping.id,
      event_id: ping.event_id,
      event_destination_id: destination.id,
      status: 'failed',
      attempt_number: 1,
      is_retryable: true,
      request: null,
      response: null
    });

    let attempt = expectOk(
      await management.get(`/organization/event-delivery-attempts/${attempts[0].id}`)
    );
    expectPresented(attempt, 'event.delivery_attempt');
    expect(attempt.error.code).toBe('request_failed');
    expect(attempt.response).toBeNull();
    expect(attempt.request).toMatchObject({ url: destination.webhook.url, method: 'POST' });

    let timestamp = headerValue(attempt.request.headers, 'metorial-timestamp')!;
    let signature = createHmac('sha256', signingSecret)
      .update(`${timestamp}.${attempt.request.body}`)
      .digest('hex');
    expect(headerValue(attempt.request.headers, 'metorial-signature')).toBe(
      `t=${timestamp},v1=${signature}`
    );
    expect(JSON.parse(attempt.request.body)).toMatchObject({
      object: 'event',
      id: ping.event_id,
      event_type: 'ping',
      payload: { message: 'ping' }
    });

    let byDestination = await listAll(management, '/organization/event-deliveries', {
      query: { event_destination_id: destination.id }
    });
    expect(byDestination.map(item => item.id)).toEqual([ping.id]);

    let retried = expectOk(
      await management.post(`/organization/event-deliveries/${ping.id}/retry`)
    );
    expect(retried.status).toBe('retrying');
    await eventually(
      async () => {
        let delivery = expectOk(
          await management.get(`/organization/event-deliveries/${ping.id}`)
        );
        expect(delivery).toMatchObject({ status: 'failed', attempt_count: 2 });
      },
      { timeoutMs: 60_000, intervalMs: 500 }
    );
  }, 180_000);

  it('rejects pings to archived destinations', async () => {
    let destination = await createDestination();
    expectOk(
      await org.clients.management.post(
        `/organization/event-destinations/${destination.id}/archive`
      )
    );

    expectError(
      await org.clients.management.post(
        `/organization/event-destinations/${destination.id}/ping`
      ),
      400,
      'bad_request'
    );
    expectError(
      await org.clients.management.post(
        `/organization/event-destinations/${destination.id}/archive`
      ),
      400,
      'bad_request'
    );
  });

  it("returns 404 for another organization's destinations, listeners, deliveries and attempts", async () => {
    let destination = await createDestination({
      webhook: { url: unresolvableUrl() },
      retry: { strategy: 'fixed', max_attempts: 1 }
    });
    let listener = await createListener(destination.id);
    let ping = expectOk(
      await org.clients.management.post(
        `/organization/event-destinations/${destination.id}/ping`
      )
    );
    let attempt = await eventually(
      async () => {
        let attempts = await listAll(
          org.clients.management,
          '/organization/event-delivery-attempts',
          {
            query: { event_delivery_id: ping.id }
          }
        );
        expect(attempts).toHaveLength(1);
        return attempts[0];
      },
      { timeoutMs: 60_000, intervalMs: 500 }
    );

    let other = otherOrg.clients.management;
    let destinationPath = `/organization/event-destinations/${destination.id}`;
    expectError(await other.get(destinationPath), 404, 'not_found');
    expectError(await other.patch(destinationPath, { name: 'hijacked' }), 404, 'not_found');
    expectError(await other.post(`${destinationPath}/archive`), 404, 'not_found');
    expectError(
      await other.post(`${destinationPath}/rotate-webhook-secret`),
      404,
      'not_found'
    );
    expectError(await other.post(`${destinationPath}/ping`), 404, 'not_found');

    let listenerPath = `/organization/event-destination-listeners/${listener.id}`;
    expectError(await other.get(listenerPath), 404, 'not_found');
    expectError(await other.patch(listenerPath, { event_types: [] }), 404, 'not_found');
    expectError(await other.delete(listenerPath), 404, 'not_found');

    expectError(
      await other.post('/organization/event-destination-listeners', {
        instance_id: otherOrg.ids.instanceId,
        event_destination_id: destination.id,
        type: 'event',
        event_types: ['organization.created']
      }),
      404,
      'not_found'
    );
    expectError(
      await other.post('/organization/event-destination-listeners', {
        instance_id: org.ids.instanceId,
        event_destination_id: destination.id,
        type: 'event',
        event_types: ['organization.created']
      }),
      404,
      'not_found'
    );

    expectError(
      await other.get(`/organization/event-deliveries/${ping.id}`),
      404,
      'not_found'
    );
    expectError(
      await other.post(`/organization/event-deliveries/${ping.id}/retry`),
      404,
      'not_found'
    );
    expectError(
      await other.get(`/organization/event-delivery-attempts/${attempt.id}`),
      404,
      'not_found'
    );

    let otherDeliveries = await listAll(other, '/organization/event-deliveries', {
      query: { event_destination_id: destination.id }
    });
    expect(otherDeliveries).toEqual([]);
    let otherDestinations = await listAll(other, '/organization/event-destinations');
    expect(otherDestinations.map(item => item.id)).not.toContain(destination.id);

    let outsider = rest(metorialEndpoints().api, { session: otherOrg.session });
    expectError(
      await outsider.get(dashboardPath(`/event-destinations/${destination.id}`)),
      404
    );

    let unchanged = expectOk(await org.clients.management.get(destinationPath));
    expect(unchanged).toMatchObject({ name: destination.name, status: 'active' });
    expect(expectOk(await org.clients.management.get(listenerPath)).event_types).toEqual([
      'organization.created'
    ]);
  }, 120_000);
});
