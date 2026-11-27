import {
  API_VERSIONS,
  eventually,
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
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createConsumer,
  createConsumerGroup,
  createListing,
  createMagicServer,
  createPortal,
  crossTenantClients,
  ids,
  instancePathFor,
  loadPortalSurface,
  waitForSubspaceTenant,
  type Consumer
} from '../consumer/_shared';

describe('api-core portal: access requests', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  beforeAll(async () => {
    await waitForSubspaceTenant(org);
  });

  let api = () => org.clients.instance;
  let requestsPath = (portalId: string, path = '') =>
    `/portals/${portalId}/access-requests${path}`;

  let setupPortal = async () => {
    let portal = await createPortal(org);
    let server = await createMagicServer(org);
    let listing = await createListing(org, portal.id, server.id);
    let consumer = await createConsumer(org, portal.id);
    return { portal, server, listing, consumer };
  };

  let requestAccess = async (
    consumer: Consumer,
    listingId: string,
    body: Record<string, unknown> = {}
  ) =>
    expectOk(
      await consumer.client.post(`/consumer/providers/${listingId}/request-access`, body)
    );

  let availability = async (consumer: Consumer, listingId: string) =>
    expectOk(await consumer.client.get(`/consumer/providers/${listingId}`)).availability;

  it('keeps access requests away from consumers and publishable keys', async () => {
    let { portal, listing, consumer } = await setupPortal();
    let request = await requestAccess(consumer, listing.id, { message: 'Private reason' });
    let { publishableKey } = await loadPortalSurface(portal.id);
    let neighbour = await createConsumer(org, portal.id);

    let clients = {
      ...crossTenantClients(org, otherOrg),
      consumer: consumer.magnetar,
      neighbour: neighbour.magnetar,
      consumerDefaultVersion: consumer.client,
      publishable: rest(metorialEndpoints().api, {
        apiKey: publishableKey,
        version: API_VERSIONS.magnetar
      })
    };
    let expected = {
      none: 401,
      session: 200,
      management: 200,
      instance: 200,
      otherSession: 404,
      otherManagement: 404,
      otherInstance: 404,
      consumer: 401,
      neighbour: 401,
      consumerDefaultVersion: 404,
      publishable: 401
    } as const;

    let lists = await expectAuthMatrix(
      clients,
      (client, name) => client.get(instancePathFor(org, name, requestsPath(portal.id))),
      expected
    );
    expect(ids(lists.instance.body.items)).toEqual([request.id]);
    expect(JSON.stringify(lists.neighbour.body)).not.toContain('Private reason');

    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(instancePathFor(org, name, requestsPath(portal.id, `/${request.id}`))),
      expected
    );

    expectError(
      await consumer.magnetar.patch(requestsPath(portal.id, `/${request.id}`), {
        status: 'approved'
      }),
      401
    );
    expect(expectOk(await api().get(requestsPath(portal.id, `/${request.id}`))).status).toBe(
      'pending'
    );
  });

  it('approves a request, grants access and refuses another review', async () => {
    let { portal, server, listing, consumer } = await setupPortal();
    expect(await availability(consumer, listing.id)).toBe('request_access');

    let request = await requestAccess(consumer, listing.id, {
      message: 'Please let me in',
      metadata: { reason: 'e2e' }
    });
    expectPresented(request, 'consumer.access_request');
    expect(request).toMatchObject({
      status: 'pending',
      message: 'Please let me in',
      resolution_message: null,
      reviewed_at: null,
      consumer_profile: { object: 'consumer.profile#preview', id: consumer.profile.id },
      target: { type: 'magic_mcp_server', magic_mcp_server: { id: server.id } }
    });
    expect(
      expectOk(await consumer.client.get(`/consumer/providers/${listing.id}`))
        .has_pending_access_request
    ).toBe(true);

    expectError(
      await consumer.client.post(`/consumer/providers/${listing.id}/request-access`, {}),
      409,
      'conflict'
    );

    let approved = expectOk(
      await api().patch(requestsPath(portal.id, `/${request.id}`), {
        status: 'approved',
        resolution_message: 'Welcome'
      })
    );
    expect(approved).toMatchObject({
      id: request.id,
      status: 'approved',
      resolution_message: 'Welcome'
    });
    expect(approved.reviewed_at).toEqual(expect.any(String));

    for (let status of ['approved', 'rejected']) {
      expectError(
        await api().patch(requestsPath(portal.id, `/${request.id}`), { status }),
        412,
        'precondition_failed'
      );
    }

    await eventually(async () => {
      expect(await availability(consumer, listing.id)).toBe('available_now');
    });
    expectError(
      await consumer.client.post(`/consumer/providers/${listing.id}/request-access`, {}),
      412,
      'precondition_failed'
    );
  });

  it('rejects a request without granting access and accepts a new one', async () => {
    let { portal, listing, consumer } = await setupPortal();
    let request = await requestAccess(consumer, listing.id);

    let rejected = expectOk(
      await api().patch(requestsPath(portal.id, `/${request.id}`), {
        status: 'rejected',
        resolution_message: 'Not today'
      })
    );
    expect(rejected).toMatchObject({ status: 'rejected', resolution_message: 'Not today' });
    expectError(
      await api().patch(requestsPath(portal.id, `/${request.id}`), { status: 'approved' }),
      412,
      'precondition_failed'
    );

    expect(await availability(consumer, listing.id)).toBe('request_access');
    let next = await requestAccess(consumer, listing.id);
    expect(next.id).not.toBe(request.id);

    let byStatus = async (status: string) =>
      ids(await listAll(api(), requestsPath(portal.id), { query: { status } }));
    expect(await byStatus('rejected')).toEqual([request.id]);
    expect(await byStatus('pending')).toEqual([next.id]);
    expect(await byStatus('approved')).toEqual([]);
  });

  it('approves into a chosen group and refuses archived or foreign groups', async () => {
    let { portal, listing, consumer } = await setupPortal();
    let sibling = await createPortal(org);
    let request = await requestAccess(consumer, listing.id);

    let foreignGroup = await createConsumerGroup(org, sibling.id);
    expectError(
      await api().patch(requestsPath(portal.id, `/${request.id}`), {
        status: 'approved',
        consumer_group_id: foreignGroup.id
      }),
      404,
      'not_found'
    );

    let archivedGroup = await createConsumerGroup(org, portal.id);
    expectOk(await api().delete(`/portals/${portal.id}/consumer-groups/${archivedGroup.id}`));
    expectError(
      await api().patch(requestsPath(portal.id, `/${request.id}`), {
        status: 'approved',
        consumer_group_id: archivedGroup.id
      }),
      412,
      'precondition_failed'
    );
    expect(expectOk(await api().get(requestsPath(portal.id, `/${request.id}`))).status).toBe(
      'pending'
    );

    let group = await createConsumerGroup(org, portal.id);
    expectOk(
      await api().patch(requestsPath(portal.id, `/${request.id}`), {
        status: 'approved',
        consumer_group_id: group.id
      })
    );

    await eventually(async () => {
      let accesses = await listAll(api(), `/portals/${portal.id}/access`, {
        query: { consumer_group_id: group.id }
      });
      expect(accesses.map(access => access.listing.id)).toEqual([listing.id]);
    });
  });

  it('filters and pages access requests', async () => {
    let { portal, listing, consumer } = await setupPortal();
    let others = [await createConsumer(org, portal.id), await createConsumer(org, portal.id)];

    let requests = [await requestAccess(consumer, listing.id)];
    for (let other of others) requests.push(await requestAccess(other, listing.id));

    let paged = await listAll(api(), requestsPath(portal.id), { limit: 1 });
    expect(new Set(ids(paged)).size).toBe(paged.length);
    expect(ids(paged).sort()).toEqual(ids(requests).sort());
    for (let item of paged) expectPresented(item, 'consumer.access_request');

    let byProfile = await listAll(api(), requestsPath(portal.id), {
      query: { consumer_profile_id: others[0]!.profile.id }
    });
    expect(ids(byProfile)).toEqual([requests[1]!.id]);
  });

  it('validates review bodies, request bodies and queries', async () => {
    let { portal, listing, consumer } = await setupPortal();
    let request = await requestAccess(consumer, listing.id);

    for (let body of [
      {},
      { status: 'pending' },
      { status: 'approved', consumer_group_id: 5 }
    ]) {
      expectError(
        await api().patch(requestsPath(portal.id, `/${request.id}`), body),
        400,
        'invalid_data'
      );
    }
    for (let query of [{ status: 'open' }, { limit: 0 }]) {
      expectError(await api().get(requestsPath(portal.id), { query }), 400, 'invalid_data');
    }
    for (let body of [{ message: 5 }, { metadata: 'reason' }]) {
      expectError(
        await consumer.client.post(`/consumer/providers/${listing.id}/request-access`, body),
        400,
        'invalid_data'
      );
    }

    expectError(
      await api().get(requestsPath(portal.id, `/${uniqueId('car')}`)),
      404,
      'not_found'
    );
    expect(expectOk(await api().get(requestsPath(portal.id, `/${request.id}`))).status).toBe(
      'pending'
    );
  });

  it('hides requests through other portals and organizations', async () => {
    let { portal, listing, consumer } = await setupPortal();
    let sibling = await createPortal(org);
    let request = await requestAccess(consumer, listing.id);

    expectError(await api().get(requestsPath(sibling.id, `/${request.id}`)), 404, 'not_found');
    expectError(
      await api().patch(requestsPath(sibling.id, `/${request.id}`), { status: 'approved' }),
      404,
      'not_found'
    );
    expect(await listAll(api(), requestsPath(sibling.id))).toEqual([]);

    let other = otherOrg.clients.instance;
    expectError(await other.get(requestsPath(portal.id, `/${request.id}`)), 404, 'not_found');
    expectError(
      await other.patch(requestsPath(portal.id, `/${request.id}`), { status: 'rejected' }),
      404,
      'not_found'
    );

    let siblingConsumer = await createConsumer(org, sibling.id);
    expectError(
      await siblingConsumer.client.post(
        `/consumer/providers/${listing.id}/request-access`,
        {}
      ),
      404,
      'not_found'
    );

    expect(expectOk(await api().get(requestsPath(portal.id, `/${request.id}`))).status).toBe(
      'pending'
    );
  });
});
