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
  useFixture,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createConsumer,
  createConsumerGroup,
  createListing,
  createMagicServer,
  createPortal,
  ids,
  instancePathFor,
  loadPortalSurface,
  useConsumerPortal,
  waitForSubspaceTenant
} from './_shared';

describe('api-core consumer: provider catalog', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let otherConsumerPortal = useConsumerPortal(otherOrg);

  beforeAll(async () => {
    await waitForSubspaceTenant(org);
    await waitForSubspaceTenant(otherOrg);
  });

  let api = () => org.clients.instance;

  let catalog = useFixture(async () => {
    let portal = await createPortal(org);
    let servers = [await createMagicServer(org), await createMagicServer(org)];
    let listings = [];
    for (let server of servers) listings.push(await createListing(org, portal.id, server.id));

    let member = await createConsumer(org, portal.id);
    let outsider = await createConsumer(org, portal.id);

    let team = await createConsumerGroup(org, portal.id);
    expectOk(
      await api().post(
        `/portals/${portal.id}/consumer-profile/${member.profile.id}/assign-groups`,
        {
          group_ids: [team.id]
        }
      )
    );
    let access = expectOk(
      await api().post(`/portals/${portal.id}/access`, {
        consumer_group_id: team.id,
        access: { type: 'magic_mcp_server', magic_mcp_server_id: servers[0]!.id }
      })
    );

    return { portal, servers, listings, member, outsider, team, access };
  });

  it('serves the catalog only to consumer sessions', async () => {
    let { portal, member } = catalog;
    let { publishableKey } = await loadPortalSurface(portal.id);

    let clients = {
      none: rest(metorialEndpoints().api),
      consumer: member.client,
      consumerMagnetar: member.magnetar,
      session: org.clients.rest,
      management: org.clients.management,
      instance: api(),
      publishable: rest(metorialEndpoints().api, {
        apiKey: publishableKey,
        version: API_VERSIONS.magnetar
      }),
      otherConsumer: otherConsumerPortal.consumer.client
    };

    let responses = await expectAuthMatrix(
      clients,
      (client, name) => client.get(instancePathFor(org, name, '/consumer/providers')),
      {
        none: 401,
        consumer: 200,
        consumerMagnetar: 200,
        session: 404,
        management: 404,
        instance: 401,
        publishable: 401,
        otherConsumer: 200
      }
    );
    expect(ids(responses.consumer.body.items).sort()).toEqual(ids(catalog.listings).sort());
    expect(ids(responses.otherConsumer.body.items)).not.toContain(catalog.listings[0]!.id);

    await expectAuthMatrix(
      clients,
      (client, name) => client.get(instancePathFor(org, name, '/consumer/providers/groups')),
      { none: 401, consumer: 200, instance: 401, publishable: 401 }
    );
  });

  it('shows availability according to the consumer groups', async () => {
    let { member, outsider, listings, servers, access } = catalog;

    let memberItems = await listAll(member.client, '/consumer/providers');
    for (let item of memberItems) expectPresented(item, 'consumer.provider');

    let granted = memberItems.find(item => item.id === listings[0]!.id);
    expect(granted).toMatchObject({
      type: 'magic_mcp_server',
      availability: 'available_now',
      has_pending_access_request: false,
      magic_mcp_server: { id: servers[0]!.id }
    });
    expect(granted.consumer_access_ids).toContain(access.id);
    expect(memberItems.find(item => item.id === listings[1]!.id)).toMatchObject({
      availability: 'request_access'
    });

    let outsiderItem = expectOk(
      await outsider.client.get(`/consumer/providers/${listings[0]!.id}`)
    );
    expect(outsiderItem).toMatchObject({
      id: listings[0]!.id,
      availability: 'request_access'
    });
    expect(outsiderItem.consumer_access_ids).not.toContain(access.id);

    let serialized = JSON.stringify(memberItems);
    expect(serialized).not.toContain(member.token);
    expect(serialized).not.toContain(member.publishableKey);
  });

  it('resolves a catalog item by listing, server or access id', async () => {
    let { member, listings, servers, access } = catalog;

    for (let catalogItemId of [listings[0]!.id, servers[0]!.id, access.id]) {
      let item = expectOk(await member.client.get(`/consumer/providers/${catalogItemId}`));
      expect(item).toMatchObject({ id: listings[0]!.id, availability: 'available_now' });
    }
    expectError(
      await member.client.get(`/consumer/providers/${uniqueId('cal')}`),
      404,
      'not_found'
    );
  });

  it('hides items of other portals and organizations', async () => {
    let { member, listings } = catalog;
    let sibling = await createPortal(org);
    let siblingServer = await createMagicServer(org);
    let siblingListing = await createListing(org, sibling.id, siblingServer.id);
    let unlistedServer = await createMagicServer(org);

    for (let catalogItemId of [siblingListing.id, siblingServer.id, unlistedServer.id]) {
      expectError(
        await member.client.get(`/consumer/providers/${catalogItemId}`),
        404,
        'not_found'
      );
    }
    expect(ids(await listAll(member.client, '/consumer/providers'))).not.toContain(
      siblingListing.id
    );

    let otherConsumer = otherConsumerPortal.consumer.client;
    expectError(
      await otherConsumer.get(`/consumer/providers/${listings[0]!.id}`),
      404,
      'not_found'
    );
    expectError(
      await otherConsumer.post(`/consumer/providers/${listings[1]!.id}/request-access`, {}),
      404,
      'not_found'
    );
  });

  it('groups catalog items by surface provider group', async () => {
    let { portal, member, listings } = catalog;
    let managementBase = `/instances/${org.ids.instanceId}/portals/${portal.id}/surface-provider-groups`;

    let providerGroup = expectOk(
      await org.clients.management.post(managementBase, { name: uniqueId('Provider Group') })
    );
    expectOk(
      await org.clients.management.post(`${managementBase}/${providerGroup.id}/listings`, {
        consumer_access_listing_id: listings[1]!.id
      })
    );

    let groups = await listAll(member.client, '/consumer/providers/groups');
    expect(ids(groups)).toContain(providerGroup.id);
    for (let group of groups) expectPresented(group, 'consumer.surface.provider_group');

    let grouped = await listAll(member.client, '/consumer/providers', {
      query: { provider_group_id: providerGroup.id }
    });
    expect(ids(grouped)).toEqual([listings[1]!.id]);

    expect(
      ids(await listAll(otherConsumerPortal.consumer.client, '/consumer/providers/groups'))
    ).not.toContain(providerGroup.id);
  });

  it('pages the catalog without gaps or duplicates', async () => {
    let paged = await listAll(catalog.member.client, '/consumer/providers', { limit: 1 });
    expect(new Set(ids(paged)).size).toBe(paged.length);
    expect(ids(paged).sort()).toEqual(ids(catalog.listings).sort());

    expectError(
      await catalog.member.client.get('/consumer/providers', { query: { limit: 0 } }),
      400,
      'invalid_data'
    );
  });

  it('refuses template-only actions for magic MCP servers', async () => {
    let { member, listings } = catalog;
    let base = `/consumer/providers/${listings[0]!.id}`;

    expectError(await member.client.post(`${base}/setup`, {}), 412, 'precondition_failed');
    expectError(
      await member.client.get(`${base}/setup/${uniqueId('iss')}`),
      412,
      'precondition_failed'
    );
    expectError(
      await member.client.post(`${base}/deploy`, {
        integration_setup_session_id: uniqueId('iss')
      }),
      412,
      'precondition_failed'
    );
    expectError(
      await member.client.post(`${base}/reconnect`, {
        magic_mcp_server_id: uniqueId('mms'),
        integration_setup_session_id: uniqueId('iss')
      }),
      412,
      'precondition_failed'
    );

    expectError(await member.client.post(`${base}/deploy`, {}), 400, 'invalid_data');
    expectError(
      await member.client.post(`${base}/reconnect`, { magic_mcp_server_id: uniqueId('mms') }),
      400,
      'invalid_data'
    );
    expectError(
      await member.client.post(`${base}/setup`, { provider_auth_method_id: 5 }),
      400,
      'invalid_data'
    );
  });

  it('removes deleted listings from the catalog', async () => {
    let portal = await createPortal(org);
    let listing = await createListing(org, portal.id, (await createMagicServer(org)).id);
    let consumer = await createConsumer(org, portal.id);
    expectOk(await consumer.client.get(`/consumer/providers/${listing.id}`));

    expectOk(await api().delete(`/portals/${portal.id}/listings/${listing.id}`));

    await eventually(async () => {
      expectError(
        await consumer.client.get(`/consumer/providers/${listing.id}`),
        404,
        'not_found'
      );
    });
    expect(await listAll(consumer.client, '/consumer/providers')).toEqual([]);
  });
});
