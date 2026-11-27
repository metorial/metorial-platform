import {
  API_VERSIONS,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  metorialEndpoints,
  rest,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  createConsumer,
  createConsumerGroup,
  createPortal,
  ids,
  loadPortalSurface,
  startConsumerSession,
  useConsumerPortal
} from './_shared';

describe('api-core consumer: session and profile', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let consumerPortal = useConsumerPortal(org);
  let otherConsumerPortal = useConsumerPortal(otherOrg);

  let api = () => org.clients.instance;
  let endpoint = () => metorialEndpoints().api;

  it('accepts a consumer token only together with the publishable key of its portal', async () => {
    let { portal, consumer } = consumerPortal;
    let siblingPortal = await createPortal(org);
    let sibling = await loadPortalSurface(siblingPortal.id);
    let foreign = await loadPortalSurface(otherConsumerPortal.portal.id);
    let { publishableKey } = await loadPortalSurface(portal.id);
    let token = consumer.token;

    let clients = {
      none: rest(endpoint()),
      consumer: consumer.client,
      consumerMagnetar: consumer.magnetar,
      consumerQueryToken: rest(endpoint(), { apiKey: publishableKey }),
      tokenOnly: rest(endpoint(), { consumerToken: token }),
      publishableOnly: rest(endpoint(), {
        apiKey: publishableKey,
        version: API_VERSIONS.magnetar
      }),
      publishableGarbageToken: rest(endpoint(), {
        apiKey: publishableKey,
        consumerToken: uniqueId('not-a-token')
      }),
      siblingPublishableKey: rest(endpoint(), {
        apiKey: sibling.publishableKey,
        consumerToken: token
      }),
      foreignPublishableKey: rest(endpoint(), {
        apiKey: foreign.publishableKey,
        consumerToken: token
      }),
      instanceSecretKey: rest(endpoint(), {
        apiKey: org.keys.instanceSecret,
        consumerToken: token
      }),
      managementKey: rest(endpoint(), { apiKey: org.keys.management, consumerToken: token }),
      dashboardSession: org.clients.rest.with({ consumerToken: token })
    };

    let responses = await expectAuthMatrix(
      clients,
      (client, name) =>
        name === 'consumerQueryToken'
          ? client.post(`/consumer/session?consumer_session_client_secret=${token}`)
          : client.post('/consumer/session'),
      {
        none: 401,
        consumer: 200,
        consumerMagnetar: 200,
        consumerQueryToken: 200,
        tokenOnly: 401,
        publishableOnly: 401,
        publishableGarbageToken: 401,
        siblingPublishableKey: 401,
        foreignPublishableKey: 401,
        instanceSecretKey: 401,
        managementKey: 401,
        dashboardSession: 404
      }
    );
    expect(responses.consumer.body.id).toBe(consumer.sessionId);
    expect(responses.consumerQueryToken.body.id).toBe(consumer.sessionId);

    expectError(
      await consumer.client
        .with({ version: API_VERSIONS.dashboard })
        .post('/consumer/session'),
      406
    );
  });

  it('presents the session without its token or key', async () => {
    let { portal, consumer } = consumerPortal;
    let { publishableKey } = await loadPortalSurface(portal.id);

    let session = expectOk(await consumer.client.post('/consumer/session'));
    expectPresented(session, 'consumer.session');
    expect(Object.keys(session).sort()).toEqual(
      ['created_at', 'expires_at', 'id', 'last_used_at', 'object'].sort()
    );
    expect(new Date(session.expires_at).getTime()).toBeGreaterThan(Date.now());

    let serialized = JSON.stringify(session);
    expect(serialized).not.toContain(consumer.token);
    expect(serialized).not.toContain(publishableKey);
  });

  it('returns the own profile and effective groups', async () => {
    let portal = await createPortal(org);
    let consumer = await createConsumer(org, portal.id);
    let neighbour = await createConsumer(org, portal.id);
    let dashboardPortal = expectOk(
      await org.clients.rest.get(
        `/dashboard/instances/${org.ids.instanceId}/portals/${portal.id}`
      )
    );

    let profile = expectOk(await consumer.client.post('/consumer/profile'));
    expectPresented(profile, 'consumer.profile');
    expect(profile).toMatchObject({
      id: consumer.profile.id,
      email: consumer.profile.email,
      status: 'active'
    });
    expect(profile).not.toHaveProperty('surface');
    expect(
      profile.groups.find(
        (assignment: any) => assignment.group.id === dashboardPortal.managed_everyone_group_id
      )
    ).toMatchObject({ assigned_via: 'default' });

    let groups = expectOk(await consumer.client.post('/consumer/profile/groups'));
    expect(ids(groups.items)).toContain(dashboardPortal.managed_everyone_group_id);
    for (let group of groups.items) expectPresented(group, 'consumer.group');

    let team = await createConsumerGroup(org, portal.id);
    expectOk(
      await api().post(
        `/portals/${portal.id}/consumer-profile/${consumer.profile.id}/assign-groups`,
        {
          group_ids: [team.id]
        }
      )
    );
    expect(
      ids(expectOk(await consumer.client.post('/consumer/profile/groups')).items)
    ).toContain(team.id);
    expect(
      ids(expectOk(await neighbour.client.post('/consumer/profile/groups')).items)
    ).not.toContain(team.id);
    expect(expectOk(await neighbour.client.post('/consumer/profile')).id).toBe(
      neighbour.profile.id
    );

    expectError(
      await consumer.client.post('/consumer/profile/groups', undefined, {
        query: { limit: 0 }
      }),
      400,
      'invalid_data'
    );
  });

  it('logs out only the current session', async () => {
    let portal = await createPortal(org);
    let consumer = await createConsumer(org, portal.id);
    let secondSession = await startConsumerSession(portal.id, consumer.profile);

    let loggedOut = expectOk(await consumer.client.post('/consumer/session/logout'));
    expectPresented(loggedOut, 'consumer.session');
    expect(loggedOut.id).toBe(consumer.sessionId);
    expect(JSON.stringify(loggedOut)).not.toContain(consumer.token);

    expectError(await consumer.client.post('/consumer/session'), 401);
    expectError(await consumer.client.post('/consumer/session/logout'), 401);
    expectError(await consumer.client.post('/consumer/profile'), 401);

    expect(expectOk(await secondSession.client.post('/consumer/session')).id).toBe(
      secondSession.sessionId
    );
  });

  it('rejects expired sessions', async () => {
    let portal = await createPortal(org);
    let consumer = await createConsumer(org, portal.id);
    expectOk(await consumer.client.post('/consumer/session'));

    await db.consumerSession.update({
      where: { id: consumer.sessionId },
      data: { expiresAt: new Date(Date.now() - 60_000) }
    });

    expectError(await consumer.client.post('/consumer/session'), 401);
    expectError(await consumer.client.post('/consumer/profile'), 401);
  });

  it('keeps consumer-only routes away from instance credentials', async () => {
    let management = org.clients.management;
    let managementMagnetar = management.with({
      version: API_VERSIONS.magnetar,
      headers: { 'metorial-instance-id': org.ids.instanceId }
    });

    for (let client of [api(), managementMagnetar]) {
      expectError(await client.post('/consumer/session'), 401);
      expectError(await client.post('/consumer/profile'), 401);
    }
    expectError(
      await management
        .with({ headers: { 'metorial-instance-id': org.ids.instanceId } })
        .post('/consumer/session'),
      404
    );
  });
});
