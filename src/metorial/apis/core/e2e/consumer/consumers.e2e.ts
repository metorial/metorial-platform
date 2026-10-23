import {
  API_VERSIONS,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  uniqueEmail,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import {
  createConsumerProfile,
  createPortal,
  crossTenantClients,
  ids,
  instancePathFor,
  loadPortalSurface,
  useConsumerPortal
} from './_shared';

describe('api-core consumer: instance consumers and surfaces', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let consumerPortal = useConsumerPortal(org);

  let api = () => org.clients.instance;
  let dashboardPath = (path: string) => instancePathFor(org, 'session', path);

  let createConsumer = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await api().post('/consumers', {
        name: uniqueId('Consumer'),
        email: uniqueEmail('consumer'),
        ...body
      })
    );

  let clientsWithConsumer = async () => {
    let { portal, consumer } = consumerPortal;
    let { publishableKey } = await loadPortalSurface(portal.id);

    return {
      ...crossTenantClients(org, otherOrg),
      consumer: consumer.magnetar,
      publishable: rest(metorialEndpoints().api, {
        apiKey: publishableKey,
        version: API_VERSIONS.magnetar
      })
    };
  };

  describe('consumers', () => {
    it('authenticates consumer routes and keeps them away from portal consumers', async () => {
      let created = await createConsumer();
      let clients = await clientsWithConsumer();
      let expected = {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404,
        consumer: 403,
        publishable: [401, 403]
      };

      await expectAuthMatrix(
        clients,
        (client, name) => client.get(instancePathFor(org, name, `/consumers/${created.id}`)),
        expected
      );
      let lists = await expectAuthMatrix(
        clients,
        (client, name) => client.get(instancePathFor(org, name, '/consumers')),
        { ...expected, otherInstance: 200 }
      );
      expect(ids(lists.otherInstance.body.items)).not.toContain(created.id);

      expectError(
        await consumerPortal.consumer.magnetar.post('/consumers', {
          name: 'Nope',
          email: uniqueEmail('nope')
        }),
        403,
        'forbidden'
      );
      expectError(
        await consumerPortal.consumer.magnetar.patch(`/consumers/${created.id}`, {
          name: 'Nope'
        }),
        403,
        'forbidden'
      );
    });

    it('creates, links and updates a consumer with the presenter shape', async () => {
      let email = uniqueEmail('linked');
      let created = await createConsumer({ name: 'First Name', email: email.toUpperCase() });
      expectPresented(created, 'consumer');
      expect(created).toMatchObject({ name: 'First Name', email, user_id: null });
      expect(created).not.toHaveProperty('is_portal_consumer');

      let linked = await createConsumer({ name: 'Second Name', email });
      expect(linked).toMatchObject({ id: created.id, name: 'Second Name', email });

      let dashboard = expectOk(
        await org.clients.rest.get(dashboardPath(`/consumers/${created.id}`))
      );
      expectPresented(dashboard, 'consumer');
      expect(dashboard).toMatchObject({
        id: created.id,
        is_organization_member: false,
        is_service_account: false
      });
      expect(dashboard.is_portal_consumer).toEqual(expect.any(Boolean));

      let updated = expectOk(
        await api().patch(`/consumers/${created.id}`, { name: 'Renamed Consumer' })
      );
      expect(updated).toMatchObject({ id: created.id, name: 'Renamed Consumer', email });
      expect(expectOk(await api().get(`/consumers/${created.id}`)).name).toBe(
        'Renamed Consumer'
      );
    });

    it('lists the profiles of a consumer across portals', async () => {
      let email = uniqueEmail('multi');
      let portals = [await createPortal(org), await createPortal(org)];
      let profiles = [];
      for (let portal of portals) {
        profiles.push(await createConsumerProfile(org, portal.id, { email }));
      }
      expect(profiles[0]!.consumer_id).toBe(profiles[1]!.consumer_id);
      let consumerId = profiles[0]!.consumer_id;

      let listed = await listAll(api(), `/consumers/${consumerId}/profiles`, { limit: 1 });
      expect(ids(listed).sort()).toEqual(ids(profiles).sort());
      for (let item of listed) expectPresented(item, 'consumer.profile');

      let fetched = expectOk(
        await api().get(`/consumers/${consumerId}/profiles/${profiles[1]!.id}`)
      );
      expect(fetched).toMatchObject({ id: profiles[1]!.id, email, consumer_id: consumerId });

      let unrelated = await createConsumer();
      expectError(
        await api().get(`/consumers/${unrelated.id}/profiles/${profiles[0]!.id}`),
        404,
        'not_found'
      );
      expect(await listAll(api(), `/consumers/${unrelated.id}/profiles`)).toEqual([]);
    });

    it('filters and pages consumers', async () => {
      let created = [await createConsumer(), await createConsumer(), await createConsumer()];

      let paged = await listAll(api(), '/consumers', { limit: 1 });
      expect(new Set(ids(paged)).size).toBe(paged.length);
      expect(ids(paged)).toEqual(expect.arrayContaining(ids(created)));

      let byEmail = await listAll(api(), '/consumers', {
        query: { email: created[1]!.email }
      });
      expect(ids(byEmail)).toEqual([created[1]!.id]);

      let byId = await listAll(api(), '/consumers', { query: { id: created[2]!.id } });
      expect(ids(byId)).toEqual([created[2]!.id]);
    });

    it('validates consumer bodies and queries', async () => {
      let created = await createConsumer();

      for (let body of [{}, { name: 'No email' }, { name: 'Bad', email: 'nope' }]) {
        expectError(await api().post('/consumers', body), 400, 'invalid_data');
      }
      expectError(
        await api().patch(`/consumers/${created.id}`, { email: 'nope' }),
        400,
        'invalid_data'
      );
      for (let query of [{ email: 'nope' }, { limit: 0 }]) {
        expectError(await api().get('/consumers', { query }), 400, 'invalid_data');
      }
      expectError(await api().get(`/consumers/${uniqueId('csm')}`), 404, 'not_found');
    });

    it('hides consumers of other organizations', async () => {
      let created = await createConsumer();
      let other = otherOrg.clients.instance;

      expectError(await other.get(`/consumers/${created.id}`), 404, 'not_found');
      expectError(
        await other.patch(`/consumers/${created.id}`, { name: 'Hijacked' }),
        404,
        'not_found'
      );
      expectError(await other.get(`/consumers/${created.id}/profiles`), 404, 'not_found');
      expect(await listAll(other, '/consumers', { query: { email: created.email } })).toEqual(
        []
      );

      let sameEmail = expectOk(
        await other.post('/consumers', { name: 'Other org', email: created.email })
      );
      expect(sameEmail.id).not.toBe(created.id);
      expect(expectOk(await api().get(`/consumers/${created.id}`)).name).toBe(created.name);
    });
  });

  describe('member consumer', () => {
    it('upserts the consumer of the signed-in member only', async () => {
      let path = '/get-member-consumer';
      let clients = await clientsWithConsumer();

      let responses = await expectAuthMatrix(
        clients,
        (client, name) =>
          client.post(instancePathFor(org, name, path), { surface_identifier: 'cli' }),
        {
          none: 401,
          session: 200,
          management: 403,
          instance: 403,
          otherSession: 404,
          otherManagement: 404,
          otherInstance: 403,
          consumer: 403,
          publishable: [401, 403]
        }
      );

      let member = responses.session.body;
      expectPresented(member, 'consumer');
      expect(member).toMatchObject({
        email: org.user.email.toLowerCase(),
        profile: { object: 'consumer.profile', email: org.user.email.toLowerCase() }
      });

      let again = expectOk(
        await org.clients.rest.post(dashboardPath(path), { surface_identifier: 'cli' })
      );
      expect(again).toMatchObject({ id: member.id, profile: { id: member.profile.id } });

      let surfaces = await listAll(org.clients.rest, dashboardPath('/consumer-surfaces'));
      let cliSurfaces = surfaces.filter(surface => surface.name === 'Metorial CLI');
      expect(cliSurfaces).toHaveLength(1);
    });

    it('requires a known surface identifier', async () => {
      let path = dashboardPath('/get-member-consumer');

      expectError(await org.clients.rest.post(path, {}), 400, 'bad_request');
      expectError(
        await org.clients.rest.post(path, { surface_identifier: 'web' }),
        400,
        'invalid_data'
      );
    });
  });

  describe('consumer surfaces', () => {
    it('lists and reads surfaces without exposing their keys', async () => {
      let portal = await createPortal(org, { session_expiry_time_in_seconds: 3600 });
      let { surface, publishableKey } = await loadPortalSurface(portal.id);
      let clients = await clientsWithConsumer();
      let expected = {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404,
        consumer: 403,
        publishable: [401, 403]
      };

      let fetched = await expectAuthMatrix(
        clients,
        (client, name) =>
          client.get(instancePathFor(org, name, `/consumer-surfaces/${surface.id}`)),
        expected
      );
      expectPresented(fetched.instance.body, 'consumer.surface');
      expect(fetched.instance.body).toMatchObject({
        id: surface.id,
        status: 'active',
        auth: { object: 'consumer.surface.auth', session_expiry_time_in_seconds: 3600 }
      });
      expect(JSON.stringify(fetched.instance.body)).not.toContain(publishableKey);

      let paged = await listAll(api(), '/consumer-surfaces', { limit: 1 });
      expect(new Set(ids(paged)).size).toBe(paged.length);
      expect(ids(paged)).toContain(surface.id);
      expect(JSON.stringify(paged)).not.toContain(publishableKey);

      expect(
        ids(await listAll(otherOrg.clients.instance, '/consumer-surfaces'))
      ).not.toContain(surface.id);
      expectError(await api().get(`/consumer-surfaces/${uniqueId('csrf')}`), 404, 'not_found');
      expectError(
        await api().get('/consumer-surfaces', { query: { limit: 0 } }),
        400,
        'invalid_data'
      );
    });
  });
});
