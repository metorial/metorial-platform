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
  createConsumerGroup,
  createListing,
  createMagicServer,
  createPortal,
  crossTenantClients,
  ids,
  instancePathFor,
  loadPortalSurface,
  useConsumerPortal
} from '../consumer/_shared';

describe('api-core portal: listings, access rules and surface provider groups', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let consumerPortal = useConsumerPortal(org);

  let api = () => org.clients.instance;
  let listingsPath = (portalId: string, path = '') => `/portals/${portalId}/listings${path}`;
  let accessPath = (portalId: string, path = '') => `/portals/${portalId}/access${path}`;
  let providerGroupsPath = (portalId: string, path = '') =>
    `/portals/${portalId}/surface-provider-groups${path}`;

  let management = () => org.clients.management;
  let managementPath = (path: string) => instancePathFor(org, 'management', path);

  let grantAccess = async (
    portalId: string,
    consumerGroupId: string,
    magicMcpServerId: string,
    body: Record<string, unknown> = {}
  ) =>
    expectOk(
      await api().post(accessPath(portalId), {
        consumer_group_id: consumerGroupId,
        access: { type: 'magic_mcp_server', magic_mcp_server_id: magicMcpServerId },
        ...body
      })
    );

  let readClients = async () => {
    let { portal, consumer } = consumerPortal;
    let { publishableKey } = await loadPortalSurface(portal.id);

    return {
      ...crossTenantClients(org, otherOrg),
      consumer: consumer.magnetar,
      consumerDefaultVersion: consumer.client,
      publishable: rest(metorialEndpoints().api, {
        apiKey: publishableKey,
        version: API_VERSIONS.magnetar
      })
    };
  };

  describe('listings', () => {
    it('authenticates listing reads and keeps writes away from consumers', async () => {
      let { portal, consumer } = consumerPortal;
      let server = await createMagicServer(org);
      let listing = await createListing(org, portal.id, server.id);
      let clients = await readClients();
      let expected = {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404,
        consumer: 200,
        consumerDefaultVersion: 404,
        publishable: 401
      } as const;

      let lists = await expectAuthMatrix(
        clients,
        (client, name) => client.get(instancePathFor(org, name, listingsPath(portal.id))),
        expected
      );
      expect(ids(lists.consumer.body.items)).toContain(listing.id);

      await expectAuthMatrix(
        clients,
        (client, name) =>
          client.get(instancePathFor(org, name, listingsPath(portal.id, `/${listing.id}`))),
        expected
      );

      expectError(
        await consumer.magnetar.post(listingsPath(portal.id), {
          access: { type: 'magic_mcp_server', magic_mcp_server_id: server.id }
        }),
        403,
        'forbidden'
      );
      expectError(
        await consumer.magnetar.patch(listingsPath(portal.id, `/${listing.id}`), {
          name: 'Nope'
        }),
        403,
        'forbidden'
      );
      expectError(
        await consumer.magnetar.delete(listingsPath(portal.id, `/${listing.id}`)),
        403,
        'forbidden'
      );
    });

    it('creates a listing per target, updates it and deletes it with its access rules', async () => {
      let portal = await createPortal(org);
      let server = await createMagicServer(org);

      let created = expectOk(
        await api().post(listingsPath(portal.id), {
          access: { type: 'magic_mcp_server', magic_mcp_server_id: server.id }
        })
      );
      expectPresented(created, 'consumer.access_listing');
      expect(created).toMatchObject({
        name: server.name,
        readme: null,
        groups: [],
        access: { type: 'magic_mcp_server', magic_mcp_server: { id: server.id } }
      });

      let name = uniqueId('Listing');
      let upserted = await createListing(org, portal.id, server.id, {
        name,
        readme: '# Readme'
      });
      expect(upserted).toMatchObject({ id: created.id, name, readme: '# Readme' });
      expect(ids(await listAll(api(), listingsPath(portal.id)))).toEqual([created.id]);

      let updated = expectOk(
        await api().patch(listingsPath(portal.id, `/${created.id}`), {
          description: 'Updated over REST',
          readme: null
        })
      );
      expect(updated).toMatchObject({ name, description: 'Updated over REST', readme: null });

      let group = await createConsumerGroup(org, portal.id);
      let access = await grantAccess(portal.id, group.id, server.id);
      expect(access.listing.id).toBe(created.id);

      expectOk(await api().delete(listingsPath(portal.id, `/${created.id}`)));
      expectError(
        await api().get(listingsPath(portal.id, `/${created.id}`)),
        404,
        'not_found'
      );
      expectError(
        await api().delete(listingsPath(portal.id, `/${created.id}`)),
        404,
        'not_found'
      );
      expectError(await api().get(accessPath(portal.id, `/${access.id}`)), 404, 'not_found');
      expect(await listAll(api(), listingsPath(portal.id))).toEqual([]);
    });

    it('filters and pages listings', async () => {
      let portal = await createPortal(org);
      let servers = [
        await createMagicServer(org),
        await createMagicServer(org),
        await createMagicServer(org)
      ];
      let listings = [];
      for (let server of servers)
        listings.push(await createListing(org, portal.id, server.id));

      let paged = await listAll(api(), listingsPath(portal.id), { limit: 1 });
      expect(new Set(ids(paged)).size).toBe(paged.length);
      expect(ids(paged).sort()).toEqual(ids(listings).sort());

      let byServer = await listAll(api(), listingsPath(portal.id), {
        query: { magic_mcp_server_id: servers[1]!.id }
      });
      expect(ids(byServer)).toEqual([listings[1]!.id]);

      let byType = await listAll(api(), listingsPath(portal.id), {
        query: { type: 'magic_mcp_server' }
      });
      expect(ids(byType).sort()).toEqual(ids(listings).sort());
      expect(
        await listAll(api(), listingsPath(portal.id), { query: { type: 'skill' } })
      ).toEqual([]);
    });

    it('rejects invalid bodies, unknown targets and foreign targets', async () => {
      let portal = consumerPortal.portal;
      let foreignServer = await createMagicServer(otherOrg);

      for (let body of [
        {},
        { access: { type: 'magic_mcp_server' } },
        { access: { type: 'unknown', magic_mcp_server_id: 'mms_1' } },
        { name: 5, access: { type: 'skill', skill_id: 'sk_1' } }
      ]) {
        expectError(await api().post(listingsPath(portal.id), body), 400, 'invalid_data');
      }
      expectError(
        await api().get(listingsPath(portal.id), { query: { type: 'agent' } }),
        400,
        'invalid_data'
      );

      for (let magicMcpServerId of [uniqueId('mms'), foreignServer.id]) {
        expectError(
          await api().post(listingsPath(portal.id), {
            access: { type: 'magic_mcp_server', magic_mcp_server_id: magicMcpServerId }
          }),
          404,
          'not_found'
        );
      }
      expect(
        await listAll(api(), listingsPath(portal.id), {
          query: { magic_mcp_server_id: foreignServer.id }
        })
      ).toEqual([]);
    });

    it('hides listings through other portals and organizations', async () => {
      let portal = await createPortal(org);
      let sibling = await createPortal(org);
      let listing = await createListing(org, portal.id, (await createMagicServer(org)).id);

      expectError(
        await api().get(listingsPath(sibling.id, `/${listing.id}`)),
        404,
        'not_found'
      );
      expectError(
        await api().patch(listingsPath(sibling.id, `/${listing.id}`), { name: 'Moved' }),
        404,
        'not_found'
      );
      expect(await listAll(api(), listingsPath(sibling.id))).toEqual([]);

      let other = otherOrg.clients.instance;
      expectError(
        await other.get(listingsPath(portal.id, `/${listing.id}`)),
        404,
        'not_found'
      );
      expectError(
        await other.delete(listingsPath(portal.id, `/${listing.id}`)),
        404,
        'not_found'
      );
      expectError(
        await consumerPortal.consumer.magnetar.get(listingsPath(portal.id, `/${listing.id}`)),
        404,
        'not_found'
      );

      expectOk(await api().get(listingsPath(portal.id, `/${listing.id}`)));
    });
  });

  describe('access rules', () => {
    it('authenticates access rule reads and keeps writes away from consumers', async () => {
      let { portal, consumer } = consumerPortal;
      let group = await createConsumerGroup(org, portal.id);
      let server = await createMagicServer(org);
      let access = await grantAccess(portal.id, group.id, server.id);
      let clients = await readClients();
      let expected = {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404,
        consumer: 200,
        consumerDefaultVersion: 404,
        publishable: 401
      } as const;

      let lists = await expectAuthMatrix(
        clients,
        (client, name) => client.get(instancePathFor(org, name, accessPath(portal.id))),
        expected
      );
      expect(ids(lists.instance.body.items)).toContain(access.id);

      await expectAuthMatrix(
        clients,
        (client, name) =>
          client.get(instancePathFor(org, name, accessPath(portal.id, `/${access.id}`))),
        expected
      );

      expectError(
        await consumer.magnetar.post(accessPath(portal.id), {
          consumer_group_id: group.id,
          access: { type: 'magic_mcp_server', magic_mcp_server_id: server.id }
        }),
        403,
        'forbidden'
      );
      expectError(
        await consumer.magnetar.delete(accessPath(portal.id, `/${access.id}`)),
        403,
        'forbidden'
      );
    });

    it('grants, renames and revokes access for a group', async () => {
      let portal = await createPortal(org);
      let group = await createConsumerGroup(org, portal.id);
      let server = await createMagicServer(org);

      let access = await grantAccess(portal.id, group.id, server.id, {
        name: uniqueId('Access'),
        description: 'Granted over REST'
      });
      expectPresented(access, 'consumer.access');
      expect(access).toMatchObject({
        access_level: null,
        description: 'Granted over REST',
        access: { type: 'magic_mcp_server', magic_mcp_server: { id: server.id } },
        consumer_group: { object: 'consumer.group', id: group.id }
      });
      expect(access.listing.id).toEqual(expect.any(String));

      let repeated = await grantAccess(portal.id, group.id, server.id);
      expect(repeated.id).toBe(access.id);

      let renamed = expectOk(
        await api().patch(accessPath(portal.id, `/${access.id}`), { name: 'Renamed access' })
      );
      expect(renamed.name).toBe('Renamed access');
      expect(
        expectOk(await api().get(listingsPath(portal.id, `/${access.listing.id}`))).name
      ).toBe('Renamed access');

      expectOk(await api().delete(accessPath(portal.id, `/${access.id}`)));
      expectError(await api().get(accessPath(portal.id, `/${access.id}`)), 404, 'not_found');
      expectError(
        await api().delete(accessPath(portal.id, `/${access.id}`)),
        404,
        'not_found'
      );
      expectOk(await api().get(listingsPath(portal.id, `/${access.listing.id}`)));
    });

    it('filters access rules by group, listing and type', async () => {
      let portal = await createPortal(org);
      let groups = [
        await createConsumerGroup(org, portal.id),
        await createConsumerGroup(org, portal.id)
      ];
      let server = await createMagicServer(org);
      let accesses = [
        await grantAccess(portal.id, groups[0]!.id, server.id),
        await grantAccess(portal.id, groups[1]!.id, server.id)
      ];
      expect(accesses[0]!.listing.id).toBe(accesses[1]!.listing.id);

      let paged = await listAll(api(), accessPath(portal.id), { limit: 1 });
      expect(ids(paged).sort()).toEqual(ids(accesses).sort());

      let byGroup = await listAll(api(), accessPath(portal.id), {
        query: { consumer_group_id: groups[1]!.id }
      });
      expect(ids(byGroup)).toEqual([accesses[1]!.id]);

      let byListing = await listAll(api(), accessPath(portal.id), {
        query: { consumer_access_listing_id: accesses[0]!.listing.id }
      });
      expect(ids(byListing).sort()).toEqual(ids(accesses).sort());

      expect(
        await listAll(api(), accessPath(portal.id), { query: { type: 'skill_group' } })
      ).toEqual([]);
    });

    it('rejects invalid bodies and groups or targets outside the portal', async () => {
      let portal = await createPortal(org);
      let sibling = await createPortal(org);
      let group = await createConsumerGroup(org, portal.id);
      let siblingGroup = await createConsumerGroup(org, sibling.id);
      let server = await createMagicServer(org);
      let foreignServer = await createMagicServer(otherOrg);

      for (let body of [
        {},
        { access: { type: 'magic_mcp_server', magic_mcp_server_id: server.id } },
        { consumer_group_id: group.id },
        {
          consumer_group_id: group.id,
          access: {
            type: 'skill_marketplace',
            skill_marketplace_id: 'smp_1',
            permission: 'own'
          }
        }
      ]) {
        expectError(await api().post(accessPath(portal.id), body), 400, 'invalid_data');
      }
      expectError(
        await api().get(accessPath(portal.id), { query: { type: 'agent' } }),
        400,
        'invalid_data'
      );

      for (let [consumerGroupId, magicMcpServerId] of [
        [siblingGroup.id, server.id],
        [uniqueId('cgrp'), server.id],
        [group.id, foreignServer.id],
        [group.id, uniqueId('mms')]
      ]) {
        expectError(
          await api().post(accessPath(portal.id), {
            consumer_group_id: consumerGroupId,
            access: { type: 'magic_mcp_server', magic_mcp_server_id: magicMcpServerId }
          }),
          404,
          'not_found'
        );
      }
      expect(await listAll(api(), accessPath(portal.id))).toEqual([]);
    });

    it('hides access rules through other portals and organizations', async () => {
      let portal = await createPortal(org);
      let sibling = await createPortal(org);
      let group = await createConsumerGroup(org, portal.id);
      let access = await grantAccess(portal.id, group.id, (await createMagicServer(org)).id);

      expectError(await api().get(accessPath(sibling.id, `/${access.id}`)), 404, 'not_found');
      expectError(
        await api().patch(accessPath(sibling.id, `/${access.id}`), { name: 'Moved' }),
        404,
        'not_found'
      );
      expect(await listAll(api(), accessPath(sibling.id))).toEqual([]);

      let other = otherOrg.clients.instance;
      expectError(await other.get(accessPath(portal.id, `/${access.id}`)), 404, 'not_found');
      expectError(
        await other.delete(accessPath(portal.id, `/${access.id}`)),
        404,
        'not_found'
      );

      expectOk(await api().get(accessPath(portal.id, `/${access.id}`)));
    });
  });

  describe('surface provider groups', () => {
    let createProviderGroup = async (portalId: string, body: Record<string, unknown> = {}) =>
      expectOk(
        await management().post(managementPath(providerGroupsPath(portalId)), {
          name: uniqueId('Provider Group'),
          ...body
        })
      );

    it('is only mounted for dashboard and management callers', async () => {
      let { portal } = consumerPortal;
      let providerGroup = await createProviderGroup(portal.id);
      let clients = await readClients();
      let expected = {
        none: 401,
        session: 200,
        management: 200,
        instance: 404,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404,
        consumer: 404,
        consumerDefaultVersion: 404
      } as const;

      let lists = await expectAuthMatrix(
        clients,
        (client, name) =>
          client.get(instancePathFor(org, name, providerGroupsPath(portal.id))),
        expected
      );
      expect(ids(lists.management.body.items)).toContain(providerGroup.id);

      await expectAuthMatrix(
        clients,
        (client, name) =>
          client.get(
            instancePathFor(org, name, providerGroupsPath(portal.id, `/${providerGroup.id}`))
          ),
        expected
      );
      expectError(
        await api().post(providerGroupsPath(portal.id), { name: uniqueId('Nope') }),
        404
      );
    });

    it('creates a group, links and unlinks listings and deletes it', async () => {
      let portal = await createPortal(org);
      let listing = await createListing(org, portal.id, (await createMagicServer(org)).id);
      let groupPath = (id: string, path = '') =>
        managementPath(providerGroupsPath(portal.id, `/${id}${path}`));

      let created = await createProviderGroup(portal.id, { description: 'Created over REST' });
      expectPresented(created, 'consumer.surface.provider_group');
      expect(created).toMatchObject({
        description: 'Created over REST',
        index: expect.any(Number)
      });

      let second = await createProviderGroup(portal.id);
      let moved = expectOk(
        await management().patch(groupPath(second.id), { name: 'Moved to the top', index: 0 })
      );
      expect(moved).toMatchObject({ id: second.id, name: 'Moved to the top', index: 0 });

      expectOk(
        await management().post(groupPath(created.id, '/listings'), {
          consumer_access_listing_id: listing.id
        })
      );
      let linked = expectOk(await api().get(listingsPath(portal.id, `/${listing.id}`)));
      expect(ids(linked.groups)).toEqual([created.id]);
      expect(
        ids(
          await listAll(api(), listingsPath(portal.id), {
            query: { consumer_surface_provider_group_id: created.id }
          })
        )
      ).toEqual([listing.id]);

      expectOk(await management().delete(groupPath(created.id, `/listings/${listing.id}`)));
      expect(
        expectOk(await api().get(listingsPath(portal.id, `/${listing.id}`))).groups
      ).toEqual([]);

      expectOk(await management().delete(groupPath(created.id)));
      expectError(await management().get(groupPath(created.id)), 404, 'not_found');
      expect(
        ids(await listAll(management(), managementPath(providerGroupsPath(portal.id))))
      ).toEqual([second.id]);
      expectOk(await api().get(listingsPath(portal.id, `/${listing.id}`)));
    });

    it('rejects invalid bodies and listings or groups of other portals', async () => {
      let portal = await createPortal(org);
      let sibling = await createPortal(org);
      let providerGroup = await createProviderGroup(portal.id);
      let siblingListing = await createListing(
        org,
        sibling.id,
        (await createMagicServer(org)).id
      );
      let groupPath = (portalId: string, path = '') =>
        managementPath(providerGroupsPath(portalId, `/${providerGroup.id}${path}`));

      for (let body of [{}, { name: 5 }]) {
        expectError(
          await management().post(managementPath(providerGroupsPath(portal.id)), body),
          400,
          'invalid_data'
        );
      }
      for (let body of [{ index: 1.5 }, { index: 'first' }]) {
        expectError(await management().patch(groupPath(portal.id), body), 400, 'invalid_data');
      }
      expectError(
        await management().post(groupPath(portal.id, '/listings'), {}),
        400,
        'invalid_data'
      );

      expectError(
        await management().post(groupPath(portal.id, '/listings'), {
          consumer_access_listing_id: siblingListing.id
        }),
        404,
        'not_found'
      );
      expectError(await management().get(groupPath(sibling.id)), 404, 'not_found');
      expectError(
        await otherOrg.clients.management.get(
          `/instances/${org.ids.instanceId}${providerGroupsPath(portal.id, `/${providerGroup.id}`)}`
        ),
        404,
        'not_found'
      );

      expectOk(await management().get(groupPath(portal.id)));
    });
  });
});
