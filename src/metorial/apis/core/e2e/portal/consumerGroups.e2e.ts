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
  createPortal,
  crossTenantClients,
  ids,
  instancePathFor,
  loadPortalSurface,
  useConsumerPortal
} from '../consumer/_shared';

describe('api-core portal: consumer groups', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let consumerPortal = useConsumerPortal(org);

  let api = () => org.clients.instance;
  let groupsPath = (portalId: string, path = '') =>
    `/portals/${portalId}/consumer-groups${path}`;

  it('authenticates consumer group routes per credential', async () => {
    let { portal, consumer } = consumerPortal;
    let group = await createConsumerGroup(org, portal.id);
    let { publishableKey } = await loadPortalSurface(portal.id);

    let clients = {
      ...crossTenantClients(org, otherOrg),
      consumer: consumer.magnetar,
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
      consumer: 200,
      publishable: 401
    } as const;

    let lists = await expectAuthMatrix(
      clients,
      (client, name) => client.get(instancePathFor(org, name, groupsPath(portal.id))),
      expected
    );
    expect(ids(lists.instance.body.items)).toContain(group.id);

    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(instancePathFor(org, name, groupsPath(portal.id, `/${group.id}`))),
      expected
    );

    expectError(
      await consumer.magnetar.post(groupsPath(portal.id), { name: uniqueId('Nope') }),
      403,
      'forbidden'
    );
    expectError(
      await consumer.magnetar.patch(groupsPath(portal.id, `/${group.id}`), { name: 'Nope' }),
      403,
      'forbidden'
    );
    expectError(
      await consumer.magnetar.delete(groupsPath(portal.id, `/${group.id}`)),
      403,
      'forbidden'
    );
  });

  it('creates, updates and archives a group and refuses changes afterwards', async () => {
    let portal = await createPortal(org);
    let name = uniqueId('Lifecycle Group');

    let created = await createConsumerGroup(org, portal.id, {
      name,
      description: 'Created by the REST suite'
    });
    expectPresented(created, 'consumer.group');
    expect(created).toMatchObject({
      status: 'active',
      name,
      description: 'Created by the REST suite',
      is_default: false
    });

    let dashboard = expectOk(
      await org.clients.rest.get(
        `/dashboard/instances/${org.ids.instanceId}${groupsPath(portal.id, `/${created.id}`)}`
      )
    );
    expect(dashboard).toMatchObject({
      id: created.id,
      is_managed: false,
      is_default_everyone_group: false
    });

    let updated = expectOk(
      await api().patch(groupsPath(portal.id, `/${created.id}`), {
        name: `${name} renamed`,
        description: 'Renamed'
      })
    );
    expect(updated).toMatchObject({ name: `${name} renamed`, description: 'Renamed' });

    let archived = expectOk(await api().delete(groupsPath(portal.id, `/${created.id}`)));
    expect(archived).toMatchObject({ id: created.id, status: 'archived' });

    expectError(
      await api().patch(groupsPath(portal.id, `/${created.id}`), { name: 'Too late' }),
      412,
      'precondition_failed'
    );
    expectError(
      await api().delete(groupsPath(portal.id, `/${created.id}`)),
      412,
      'precondition_failed'
    );

    let archivedList = await listAll(api(), groupsPath(portal.id), {
      query: { status: 'archived' }
    });
    expect(ids(archivedList)).toEqual([created.id]);
    let activeList = await listAll(api(), groupsPath(portal.id), {
      query: { status: 'active' }
    });
    expect(ids(activeList)).not.toContain(created.id);
  });

  it('exposes the managed everyone group of a portal on the dashboard', async () => {
    let portal = await createPortal(org);
    let dashboardPath = `/dashboard/instances/${org.ids.instanceId}`;

    let dashboardPortal = expectOk(
      await org.clients.rest.get(`${dashboardPath}/portals/${portal.id}`)
    );
    let groups = await listAll(org.clients.rest, `${dashboardPath}${groupsPath(portal.id)}`);

    let everyone = groups.filter(group => group.is_default_everyone_group);
    expect(ids(everyone)).toEqual([dashboardPortal.managed_everyone_group_id]);
    expect(everyone[0]).toMatchObject({ is_default: true, is_managed: true });

    let everyonePath = groupsPath(portal.id, `/${everyone[0].id}`);
    expect(expectOk(await api().patch(everyonePath, { is_default: false })).is_default).toBe(
      true
    );
    expectError(await api().delete(everyonePath), 400, 'bad_request');
    expect(expectOk(await api().get(everyonePath)).status).toBe('active');
  });

  it('validates consumer group bodies and queries', async () => {
    let portal = consumerPortal.portal;
    let group = await createConsumerGroup(org, portal.id);

    for (let body of [{}, { name: 5 }, { name: uniqueId('Group'), is_default: 'yes' }]) {
      expectError(await api().post(groupsPath(portal.id), body), 400, 'invalid_data');
    }
    expectError(
      await api().patch(groupsPath(portal.id, `/${group.id}`), { description: 7 }),
      400,
      'invalid_data'
    );
    expectError(
      await api().get(groupsPath(portal.id), { query: { status: 'gone' } }),
      400,
      'invalid_data'
    );
    expectError(
      await api().get(groupsPath(portal.id, `/${uniqueId('cgrp')}`)),
      404,
      'not_found'
    );
  });

  it('pages through consumer groups without gaps or duplicates', async () => {
    let portal = await createPortal(org);
    let created = [
      await createConsumerGroup(org, portal.id),
      await createConsumerGroup(org, portal.id),
      await createConsumerGroup(org, portal.id)
    ];

    let paged = await listAll(api(), groupsPath(portal.id), { limit: 1 });
    expect(new Set(ids(paged)).size).toBe(paged.length);
    expect(ids(paged)).toEqual(expect.arrayContaining(ids(created)));
    for (let item of paged) expectPresented(item, 'consumer.group');
  });

  it('hides groups through other portals and organizations', async () => {
    let portal = await createPortal(org);
    let sibling = await createPortal(org);
    let group = await createConsumerGroup(org, portal.id);

    expectError(await api().get(groupsPath(sibling.id, `/${group.id}`)), 404, 'not_found');
    expectError(
      await api().patch(groupsPath(sibling.id, `/${group.id}`), { name: 'Moved' }),
      404,
      'not_found'
    );
    expect(ids(await listAll(api(), groupsPath(sibling.id)))).not.toContain(group.id);

    let other = otherOrg.clients.instance;
    expectError(await other.get(groupsPath(portal.id, `/${group.id}`)), 404, 'not_found');
    expectError(await other.delete(groupsPath(portal.id, `/${group.id}`)), 404, 'not_found');

    let consumerOfSibling = consumerPortal.consumer.magnetar;
    expectError(
      await consumerOfSibling.get(groupsPath(portal.id, `/${group.id}`)),
      404,
      'not_found'
    );

    expect(expectOk(await api().get(groupsPath(portal.id, `/${group.id}`))).status).toBe(
      'active'
    );
  });
});
