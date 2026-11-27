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
  createConsumer,
  createConsumerGroup,
  createConsumerProfile,
  createPortal,
  crossTenantClients,
  ids,
  instancePathFor,
  loadPortalSurface,
  startConsumerSession,
  useConsumerPortal
} from '../consumer/_shared';

describe('api-core portal: consumer profiles and invites', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let consumerPortal = useConsumerPortal(org);

  let api = () => org.clients.instance;
  let profilesPath = (portalId: string, path = '') =>
    `/portals/${portalId}/consumer-profile${path}`;
  let invitesPath = (portalId: string, path = '') =>
    `/portals/${portalId}/consumer-invites${path}`;
  let groupIds = (profile: any) =>
    profile.groups.map((assignment: any) => assignment.group.id);

  let publishableClient = async (portalId: string) => {
    let { publishableKey } = await loadPortalSurface(portalId);
    return rest(metorialEndpoints().api, {
      apiKey: publishableKey,
      version: API_VERSIONS.magnetar
    });
  };

  it('authenticates profile reads per credential and keeps writes away from consumers', async () => {
    let { portal, consumer } = consumerPortal;
    let profile = await createConsumerProfile(org, portal.id);

    let clients = {
      ...crossTenantClients(org, otherOrg),
      consumer: consumer.magnetar,
      publishable: await publishableClient(portal.id)
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
      (client, name) => client.get(instancePathFor(org, name, profilesPath(portal.id))),
      expected
    );
    expect(ids(lists.instance.body.items)).toContain(profile.id);
    expect(ids(lists.consumer.body.items)).toContain(consumer.profile.id);

    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(instancePathFor(org, name, profilesPath(portal.id, `/${profile.id}`))),
      expected
    );

    expectError(
      await consumer.magnetar.post(profilesPath(portal.id), {
        email: uniqueEmail('nope'),
        name: 'Nope'
      }),
      403,
      'forbidden'
    );
    expectError(
      await consumer.magnetar.delete(profilesPath(portal.id, `/${profile.id}`)),
      403,
      'forbidden'
    );
    expectError(
      await consumer.magnetar.post(
        profilesPath(portal.id, `/${consumer.profile.id}/assign-groups`),
        {
          group_ids: []
        }
      ),
      403,
      'forbidden'
    );
  });

  it('keeps invites away from consumers and publishable keys', async () => {
    let { portal, consumer } = consumerPortal;
    let invite = expectOk(
      await api().post(invitesPath(portal.id), {
        name: 'Invitee',
        email: uniqueEmail('invitee')
      })
    );

    let clients = {
      ...crossTenantClients(org, otherOrg),
      consumer: consumer.magnetar,
      publishable: await publishableClient(portal.id)
    };
    let expected = {
      none: 401,
      session: 200,
      management: 200,
      instance: 200,
      otherSession: 404,
      otherManagement: 404,
      otherInstance: 404,
      consumer: 403,
      publishable: 401
    } as const;

    await expectAuthMatrix(
      clients,
      (client, name) => client.get(instancePathFor(org, name, invitesPath(portal.id))),
      expected
    );
    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(instancePathFor(org, name, invitesPath(portal.id, `/${invite.id}`))),
      expected
    );
    expectError(
      await consumer.magnetar.post(invitesPath(portal.id), {
        name: 'Friend',
        email: uniqueEmail('friend')
      }),
      403,
      'forbidden'
    );
  });

  it('creates, assigns and deletes a profile and revokes its sessions', async () => {
    let portal = await createPortal(org);
    let { publishableKey } = await loadPortalSurface(portal.id);
    let email = uniqueEmail('profile');
    let name = uniqueId('Profile');

    let created = await createConsumerProfile(org, portal.id, { email, name });
    expectPresented(created, 'consumer.profile');
    expect(created).toMatchObject({
      email,
      name,
      status: 'active',
      user_id: null,
      groups: []
    });
    expect(created.consumer_id).toEqual(expect.any(String));

    let dashboard = expectOk(
      await org.clients.rest.get(
        `/dashboard/instances/${org.ids.instanceId}${profilesPath(portal.id, `/${created.id}`)}`
      )
    );
    expect(dashboard).toMatchObject({
      id: created.id,
      is_service_account: false,
      surface: { object: 'consumer.surface' }
    });
    expect(JSON.stringify(dashboard)).not.toContain(publishableKey);

    expectError(
      await api().post(profilesPath(portal.id), { email, name: 'Duplicate' }),
      409,
      'conflict'
    );

    let group = await createConsumerGroup(org, portal.id);
    let assigned = expectOk(
      await api().post(profilesPath(portal.id, `/${created.id}/assign-groups`), {
        group_ids: [group.id]
      })
    );
    expect(groupIds(assigned)).toContain(group.id);
    expect(
      assigned.groups.find((assignment: any) => assignment.group.id === group.id)
    ).toMatchObject({ object: 'consumer.profile.group_assignment', assigned_via: 'manual' });

    let members = await listAll(api(), profilesPath(portal.id), {
      query: { consumer_group_id: group.id }
    });
    expect(ids(members)).toEqual([created.id]);

    let unassigned = expectOk(
      await api().post(profilesPath(portal.id, `/${created.id}/unassign-groups`), {
        group_ids: [group.id]
      })
    );
    expect(groupIds(unassigned)).not.toContain(group.id);
    expect(
      await listAll(api(), profilesPath(portal.id), { query: { consumer_group_id: group.id } })
    ).toEqual([]);

    let consumer = await startConsumerSession(portal.id, created);
    expectOk(await consumer.client.post('/consumer/session'));

    expectOk(await api().delete(profilesPath(portal.id, `/${created.id}`)));
    expectError(await api().get(profilesPath(portal.id, `/${created.id}`)), 404, 'not_found');
    expectError(
      await api().delete(profilesPath(portal.id, `/${created.id}`)),
      404,
      'not_found'
    );
    expect(ids(await listAll(api(), profilesPath(portal.id)))).not.toContain(created.id);
    expectError(await consumer.client.post('/consumer/session'), 401);

    let recreated = await createConsumerProfile(org, portal.id, { email, name });
    expect(recreated.id).not.toBe(created.id);
  });

  it('refuses archived and foreign groups when assigning', async () => {
    let portal = await createPortal(org);
    let sibling = await createPortal(org);
    let profile = await createConsumerProfile(org, portal.id);

    let archived = await createConsumerGroup(org, portal.id);
    expectOk(await api().delete(`/portals/${portal.id}/consumer-groups/${archived.id}`));
    let foreign = await createConsumerGroup(org, sibling.id);

    for (let groupId of [archived.id, foreign.id, uniqueId('cgrp')]) {
      expectError(
        await api().post(profilesPath(portal.id, `/${profile.id}/assign-groups`), {
          group_ids: [groupId]
        }),
        404,
        'not_found'
      );
    }

    let current = expectOk(await api().get(profilesPath(portal.id, `/${profile.id}`)));
    expect(groupIds(current)).not.toContain(archived.id);
    expect(groupIds(current)).not.toContain(foreign.id);
  });

  it('invites a consumer, refreshes a pending invite and refuses active profiles', async () => {
    let portal = await createPortal(org);
    let email = uniqueEmail('invitee');

    let invite = expectOk(
      await api().post(invitesPath(portal.id), {
        name: 'Invitee',
        email,
        message: 'Join our portal'
      })
    );
    expectPresented(invite, 'consumer.invite');
    expect(invite).toMatchObject({
      status: 'pending',
      message: 'Join our portal',
      accepted_at: null,
      consumer_profile: { object: 'consumer.profile#preview', email, name: 'Invitee' },
      invited_by: { object: 'organization.actor#preview' }
    });
    expect(invite.portal_url).toEqual(expect.any(String));

    expect(expectOk(await api().get(invitesPath(portal.id, `/${invite.id}`))).id).toBe(
      invite.id
    );

    let invitedProfiles = await listAll(api(), profilesPath(portal.id), {
      query: { status: 'invited' }
    });
    expect(ids(invitedProfiles)).toEqual([invite.consumer_profile.id]);
    expect(invitedProfiles[0].status).toBe('invited');

    let refreshed = expectOk(
      await api().post(invitesPath(portal.id), { name: 'Invitee', email, message: 'Reminder' })
    );
    expect(refreshed).toMatchObject({ id: invite.id, status: 'pending', message: 'Reminder' });

    let pending = await listAll(api(), invitesPath(portal.id), {
      query: { status: 'pending' }
    });
    expect(ids(pending)).toEqual([invite.id]);
    expect(
      await listAll(api(), invitesPath(portal.id), { query: { status: 'accepted' } })
    ).toEqual([]);
    expect(ids(await listAll(api(), invitesPath(portal.id), { query: { email } }))).toEqual([
      invite.id
    ]);

    let active = await createConsumerProfile(org, portal.id);
    expectError(
      await api().post(invitesPath(portal.id), { name: 'Again', email: active.email }),
      409,
      'conflict'
    );
    expect(
      await listAll(api(), invitesPath(portal.id), { query: { email: active.email } })
    ).toEqual([]);
  });

  it('filters and pages profiles', async () => {
    let portal = await createPortal(org);
    let created = [
      await createConsumerProfile(org, portal.id),
      await createConsumerProfile(org, portal.id),
      await createConsumerProfile(org, portal.id)
    ];

    let withoutMembers = (items: any[]) =>
      ids(items.filter(item => item.user_id === null)).sort();

    let paged = await listAll(api(), profilesPath(portal.id), { limit: 1 });
    expect(new Set(ids(paged)).size).toBe(paged.length);
    expect(withoutMembers(paged)).toEqual(ids(created).sort());
    for (let item of paged) expectPresented(item, 'consumer.profile');

    let byEmail = await listAll(api(), profilesPath(portal.id), {
      query: { email: created[1].email }
    });
    expect(ids(byEmail)).toEqual([created[1].id]);

    let active = await listAll(api(), profilesPath(portal.id), {
      query: { status: 'active' }
    });
    expect(withoutMembers(active)).toEqual(ids(created).sort());
  });

  it('validates profile and invite bodies and queries', async () => {
    let portal = consumerPortal.portal;
    let profile = consumerPortal.consumer.profile;

    for (let body of [{}, { name: 'No email' }, { email: 'not-an-email', name: 'Bad' }]) {
      expectError(await api().post(profilesPath(portal.id), body), 400, 'invalid_data');
    }
    for (let body of [{}, { group_ids: 'cgrp_1' }, { group_ids: [1] }]) {
      expectError(
        await api().post(profilesPath(portal.id, `/${profile.id}/assign-groups`), body),
        400,
        'invalid_data'
      );
    }
    for (let query of [{ email: 'not-an-email' }, { status: 'deleted' }, { limit: 0 }]) {
      expectError(await api().get(profilesPath(portal.id), { query }), 400, 'invalid_data');
    }

    for (let body of [{ email: uniqueEmail('x') }, { name: 'Bad', email: 'nope' }]) {
      expectError(await api().post(invitesPath(portal.id), body), 400, 'invalid_data');
    }
    expectError(
      await api().get(invitesPath(portal.id), { query: { status: 'expired' } }),
      400,
      'invalid_data'
    );

    expectError(
      await api().get(profilesPath(portal.id, `/${uniqueId('cprf')}`)),
      404,
      'not_found'
    );
    expectError(
      await api().get(invitesPath(portal.id, `/${uniqueId('cinv')}`)),
      404,
      'not_found'
    );
  });

  it('hides profiles and invites through other portals and organizations', async () => {
    let portal = await createPortal(org);
    let sibling = await createPortal(org);
    let profile = await createConsumerProfile(org, portal.id);
    let invite = expectOk(
      await api().post(invitesPath(portal.id), {
        name: 'Invitee',
        email: uniqueEmail('hidden')
      })
    );

    for (let path of [
      profilesPath(sibling.id, `/${profile.id}`),
      invitesPath(sibling.id, `/${invite.id}`)
    ]) {
      expectError(await api().get(path), 404, 'not_found');
    }
    expectError(
      await api().post(profilesPath(sibling.id, `/${profile.id}/assign-groups`), {
        group_ids: []
      }),
      404,
      'not_found'
    );
    expect(ids(await listAll(api(), profilesPath(sibling.id)))).not.toContain(profile.id);

    let other = otherOrg.clients.instance;
    expectError(await other.get(profilesPath(portal.id, `/${profile.id}`)), 404, 'not_found');
    expectError(
      await other.delete(profilesPath(portal.id, `/${profile.id}`)),
      404,
      'not_found'
    );
    expectError(await other.get(invitesPath(portal.id, `/${invite.id}`)), 404, 'not_found');

    let siblingConsumer = await createConsumer(org, sibling.id);
    expectError(
      await siblingConsumer.magnetar.get(profilesPath(portal.id, `/${profile.id}`)),
      404,
      'not_found'
    );
    expectError(
      await siblingConsumer.magnetar.get(profilesPath(sibling.id, `/${profile.id}`)),
      404,
      'not_found'
    );

    expect(expectOk(await api().get(profilesPath(portal.id, `/${profile.id}`))).email).toBe(
      profile.email
    );
  });
});
