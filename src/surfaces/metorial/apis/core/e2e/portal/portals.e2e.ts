import {
  API_VERSIONS,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import {
  createConsumer,
  createPortal,
  crossTenantClients,
  ids,
  instancePathFor,
  loadPortalSurface,
  useConsumerPortal
} from '../consumer/_shared';

describe('api-core portal: portals', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let consumerPortal = useConsumerPortal(org);
  let otherConsumerPortal = useConsumerPortal(otherOrg);

  let api = () => org.clients.instance;

  it('authenticates portal reads per credential', async () => {
    let { portal, consumer } = consumerPortal;
    let { publishableKey } = await loadPortalSurface(portal.id);
    let siblingConsumer = await createConsumer(org, (await createPortal(org)).id);

    let clients = {
      ...crossTenantClients(org, otherOrg),
      consumer: consumer.magnetar,
      consumerDefaultVersion: consumer.client,
      siblingConsumer: siblingConsumer.magnetar,
      otherConsumer: otherConsumerPortal.consumer.magnetar,
      publishable: rest(metorialEndpoints().api, {
        apiKey: publishableKey,
        version: API_VERSIONS.magnetar
      })
    };

    let responses = await expectAuthMatrix(
      clients,
      (client, name) => client.get(instancePathFor(org, name, `/portals/${portal.id}`)),
      {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404,
        consumer: 200,
        consumerDefaultVersion: 404,
        siblingConsumer: 404,
        otherConsumer: 404,
        publishable: 401
      }
    );
    expect(responses.consumer.body.id).toBe(portal.id);

    let lists = await expectAuthMatrix(
      clients,
      (client, name) => client.get(instancePathFor(org, name, '/portals')),
      {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 200,
        publishable: 401
      }
    );
    expect(ids(lists.instance.body.items)).toContain(portal.id);
    expect(ids(lists.otherInstance.body.items)).not.toContain(portal.id);
  });

  it('forbids portal writes to consumers and publishable keys', async () => {
    let { portal, consumer } = consumerPortal;
    let { publishableKey } = await loadPortalSurface(portal.id);
    let publishable = rest(metorialEndpoints().api, {
      apiKey: publishableKey,
      version: API_VERSIONS.magnetar
    });

    for (let client of [consumer.magnetar, publishable]) {
      expectError(await client.post('/portals', { name: uniqueId('Nope') }), 403, 'forbidden');
    }
    expectError(
      await consumer.magnetar.patch(`/portals/${portal.id}`, { name: 'Taken over' }),
      403,
      'forbidden'
    );
    expectError(await consumer.magnetar.delete(`/portals/${portal.id}`), 403, 'forbidden');

    expect(expectOk(await api().get(`/portals/${portal.id}`)).status).toBe('active');
  });

  it('lists only the own portal to a consumer', async () => {
    let sibling = await createPortal(org);

    let listed = await listAll(consumerPortal.consumer.magnetar, '/portals');
    expect(ids(listed)).toEqual([consumerPortal.portal.id]);
    expect(ids(listed)).not.toContain(sibling.id);
  });

  it('creates, updates and archives a portal with the presenter shape', async () => {
    let name = uniqueId('Lifecycle Portal');
    let created = await createPortal(org, {
      name,
      description: 'Created by the REST suite',
      session_expiry_time_in_seconds: 3600,
      allowed_redirect_url_filters: [{ url: 'https://app.example.com/callback' }],
      allow_consumer_skill_authoring: false
    });

    expectPresented(created, 'portal');
    expect(created).toMatchObject({
      status: 'active',
      name,
      description: 'Created by the REST suite',
      allow_consumer_skill_authoring: false,
      auth: {
        object: 'portal.auth',
        session_expiry_time_in_seconds: 3600,
        allowed_redirect_url_filters: [{ url: 'https://app.example.com/callback' }]
      }
    });
    expect(created.urls.length).toBeGreaterThan(0);
    expect(created).not.toHaveProperty('managed_everyone_group_id');

    let { publishableKey } = await loadPortalSurface(created.id);
    expect(JSON.stringify(created)).not.toContain(publishableKey);

    let dashboard = expectOk(
      await org.clients.rest.get(
        `/dashboard/instances/${org.ids.instanceId}/portals/${created.id}`
      )
    );
    expectPresented(dashboard, 'portal');
    expect(dashboard.managed_everyone_group_id).toEqual(expect.any(String));
    expect(JSON.stringify(dashboard)).not.toContain(publishableKey);

    let updated = expectOk(
      await api().patch(`/portals/${created.id}`, {
        name: `${name} renamed`,
        session_expiry_time_in_seconds: 7200,
        allow_consumer_skill_authoring: true,
        skill_configuration: { allow_scripts: false }
      })
    );
    expect(updated).toMatchObject({
      id: created.id,
      slug: created.slug,
      name: `${name} renamed`,
      allow_consumer_skill_authoring: true,
      auth: { session_expiry_time_in_seconds: 7200 },
      skill_configuration: { object: 'portal.skill_configuration', allow_scripts: false }
    });

    let archived = expectOk(await api().delete(`/portals/${created.id}`));
    expect(archived).toMatchObject({ id: created.id, status: 'archived' });

    expectError(
      await api().patch(`/portals/${created.id}`, { name: 'Too late' }),
      412,
      'precondition_failed'
    );
    expectError(await api().delete(`/portals/${created.id}`), 412, 'precondition_failed');
    expect(expectOk(await api().get(`/portals/${created.id}`)).status).toBe('archived');
    expect(ids(await listAll(api(), '/portals'))).not.toContain(created.id);
  });

  it('rejects consumers of an archived portal', async () => {
    let portal = await createPortal(org);
    let consumer = await createConsumer(org, portal.id);
    expectOk(await consumer.magnetar.get(`/portals/${portal.id}`));

    expectOk(await api().delete(`/portals/${portal.id}`));

    expectError(await consumer.magnetar.get(`/portals/${portal.id}`), 401);
    expectError(await consumer.client.post('/consumer/session'), 401);
  });

  it('validates portal bodies and queries', async () => {
    let portal = consumerPortal.portal;

    for (let body of [
      {},
      { name: 5 },
      { name: uniqueId('Portal'), session_expiry_time_in_seconds: 599 },
      { name: uniqueId('Portal'), session_expiry_time_in_seconds: 60 * 60 * 24 * 61 },
      { name: uniqueId('Portal'), allowed_redirect_url_filters: [{}] },
      { name: uniqueId('Portal'), allow_consumer_skill_publishing: 'yes' }
    ]) {
      expectError(await api().post('/portals', body), 400, 'invalid_data');
    }
    expectError(
      await api().post('/portals', {
        name: uniqueId('Portal'),
        allowed_redirect_url_filters: [{ url: 'ftp://files.example.com/*' }]
      }),
      400,
      'bad_request'
    );

    for (let body of [
      { session_expiry_time_in_seconds: 'long' },
      { skill_configuration: { allowed_file_extensions: 'md' } },
      { description: 42 }
    ]) {
      expectError(await api().patch(`/portals/${portal.id}`, body), 400, 'invalid_data');
    }

    expectError(await api().get('/portals', { query: { limit: 0 } }), 400, 'invalid_data');
    expectError(await api().get(`/portals/${uniqueId('portal')}`), 404, 'not_found');
  });

  it('pages through portals and filters them by search', async () => {
    let marker = uniqueId('paged');
    let created = [
      await createPortal(org, { name: `${marker} one` }),
      await createPortal(org, { name: `${marker} two` }),
      await createPortal(org, { name: `${marker} three` })
    ];

    let paged = await listAll(api(), '/portals', { limit: 1 });
    expect(new Set(ids(paged)).size).toBe(paged.length);
    expect(ids(paged)).toEqual(expect.arrayContaining(ids(created)));
    for (let item of paged) expectPresented(item, 'portal');

    let searched = await listAll(api(), '/portals', { query: { search: marker } });
    expect(ids(searched).sort()).toEqual(ids(created).sort());
  });

  it('hides portals of other organizations', async () => {
    let portal = await createPortal(org);
    let other = otherOrg.clients.instance;

    expectError(await other.get(`/portals/${portal.id}`), 404, 'not_found');
    expectError(
      await other.patch(`/portals/${portal.id}`, { name: 'Hijacked' }),
      404,
      'not_found'
    );
    expectError(await other.delete(`/portals/${portal.id}`), 404, 'not_found');
    expectError(
      await otherOrg.clients.management.get(
        `/instances/${org.ids.instanceId}/portals/${portal.id}`
      ),
      404,
      'not_found'
    );
    expect(ids(await listAll(other, '/portals'))).not.toContain(portal.id);

    expect(expectOk(await api().get(`/portals/${portal.id}`)).name).toBe(portal.name);
  });
});
