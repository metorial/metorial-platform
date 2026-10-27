import {
  authClients,
  bootstrapUser,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  uniqueEmail,
  useOrganization
} from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';

describe('api-core dashboard: organization join', () => {
  let org = useOrganization();

  let orgPath = (path = '') => `/dashboard/organizations/${org.ids.organizationId}${path}`;

  let signUp = async () => {
    let user = await bootstrapUser();
    return { user, client: rest(metorialEndpoints().api, { session: user.session }) };
  };

  let createLinkInvite = async (role: 'member' | 'admin' = 'member') => {
    let invite = expectOk(
      await org.clients.rest.post(orgPath('/invites'), { type: 'link', role })
    );
    return { invite, key: invite.invite_link.key as string };
  };

  let createEmailInvite = async () => {
    let invite = expectOk(
      await org.clients.management.post('/organization/invites', {
        type: 'email',
        email: uniqueEmail('join'),
        role: 'member'
      })
    );
    let stored = await db.organizationInvite.findUniqueOrThrow({ where: { id: invite.id } });
    return { invite, key: stored.key };
  };

  let membersOf = async () =>
    await listAll(org.clients.rest, orgPath('/members'), { limit: 100 });

  let findMember = async (userId: string) =>
    (await membersOf()).find(
      (item: any) => item.user?.id === userId || item.user_id === userId
    );

  it('only lets user sessions look up and answer invites', async () => {
    let { key } = await createLinkInvite();
    let clients = authClients(org);
    let memberIds = (await membersOf()).map((item: any) => item.id);

    for (let call of [
      (client: typeof org.clients.rest) =>
        client.get('/dashboard/organization-join/find', { query: { invite_key: key } }),
      (client: typeof org.clients.rest) =>
        client.post('/dashboard/organization-join/accept', { invite_key: key }),
      (client: typeof org.clients.rest) =>
        client.post('/dashboard/organization-join/reject', { invite_key: key })
    ]) {
      await expectAuthMatrix(clients, call, { none: 401, management: 403, instance: 404 });
    }

    expect((await membersOf()).map((item: any) => item.id)).toEqual(memberIds);
  });

  it('looks up a pending link invite by key', async () => {
    let { invite, key } = await createLinkInvite('admin');
    let { client } = await signUp();

    let found = expectOk(
      await client.get('/dashboard/organization-join/find', { query: { invite_key: key } })
    );
    expectPresented(found, 'organization.invite');
    expect(found).toMatchObject({
      id: invite.id,
      status: 'pending',
      role: 'admin',
      type: 'link',
      organization: { id: org.ids.organizationId }
    });
    expect(found.invited_by.object).toBe('organization.actor');
  });

  it('validates invite keys', async () => {
    let { client } = await signUp();

    expectError(await client.get('/dashboard/organization-join/find'), 400, 'invalid_data');
    expectError(
      await client.post('/dashboard/organization-join/accept', {}),
      400,
      'invalid_data'
    );
    expectError(
      await client.post('/dashboard/organization-join/reject', { invite_key: 42 }),
      400,
      'invalid_data'
    );

    let unknown = `mt_${crypto.randomUUID()}`;
    expectError(
      await client.get('/dashboard/organization-join/find', {
        query: { invite_key: unknown }
      }),
      404,
      'not_found'
    );
    expectError(
      await client.post('/dashboard/organization-join/accept', { invite_key: unknown }),
      404,
      'not_found'
    );
    expectError(
      await client.post('/dashboard/organization-join/reject', { invite_key: unknown }),
      404,
      'not_found'
    );
  });

  it('joins through a link invite with its role, once', async () => {
    let { invite, key } = await createLinkInvite('admin');
    let { user, client } = await signUp();

    expectError(await client.get(orgPath()), 404, 'not_found');

    let accepted = expectOk(
      await client.post('/dashboard/organization-join/accept', { invite_key: key })
    );
    expectPresented(accepted, 'organization.invite');
    expect(accepted).toMatchObject({ id: invite.id, status: 'pending', type: 'link' });

    let joined = await findMember(user.id);
    expect(joined).toMatchObject({ role: 'admin', status: 'active' });
    expect(expectOk(await client.get(orgPath())).id).toBe(org.ids.organizationId);

    let again = expectOk(
      await client.post('/dashboard/organization-join/accept', { invite_key: key })
    );
    expect(again.id).toBe(invite.id);
    expect(
      (await membersOf()).filter(
        (item: any) => item.user?.id === user.id || item.user_id === user.id
      )
    ).toHaveLength(1);
  });

  it('keeps a link invite usable after one user rejects it', async () => {
    let { invite, key } = await createLinkInvite();
    let rejecter = await signUp();

    let rejected = expectOk(
      await rejecter.client.post('/dashboard/organization-join/reject', { invite_key: key })
    );
    expect(rejected).toMatchObject({ id: invite.id, status: 'pending' });
    expect(await findMember(rejecter.user.id)).toBeUndefined();

    let joiner = await signUp();
    expectOk(
      await joiner.client.post('/dashboard/organization-join/accept', { invite_key: key })
    );
    expect(await findMember(joiner.user.id)).toMatchObject({ role: 'member' });
  });

  it('uses up an email invite when it is accepted', async () => {
    let { invite, key } = await createEmailInvite();
    let { user, client } = await signUp();

    let found = expectOk(
      await client.get('/dashboard/organization-join/find', { query: { invite_key: key } })
    );
    expect(found).toMatchObject({ id: invite.id, type: 'email', status: 'pending' });
    expect(found.invite_link.key).toBeNull();

    let accepted = expectOk(
      await client.post('/dashboard/organization-join/accept', { invite_key: key })
    );
    expect(accepted).toMatchObject({ id: invite.id, status: 'accepted' });
    expect(accepted.accepted_at).toEqual(expect.any(String));
    expect(await findMember(user.id)).toMatchObject({ role: 'member' });

    let late = await signUp();
    expectError(
      await late.client.get('/dashboard/organization-join/find', {
        query: { invite_key: key }
      }),
      404,
      'not_found'
    );
    expectError(
      await late.client.post('/dashboard/organization-join/accept', { invite_key: key }),
      404,
      'not_found'
    );
  });

  it('closes an email invite when it is rejected', async () => {
    let { invite, key } = await createEmailInvite();
    let { user, client } = await signUp();

    let rejected = expectOk(
      await client.post('/dashboard/organization-join/reject', { invite_key: key })
    );
    expect(rejected).toMatchObject({ id: invite.id, status: 'rejected' });
    expect(rejected.rejected_at).toEqual(expect.any(String));

    expectError(
      await client.post('/dashboard/organization-join/accept', { invite_key: key }),
      404,
      'not_found'
    );
    expect(await findMember(user.id)).toBeUndefined();
    expect(
      expectOk(await org.clients.management.get(`/organization/invites/${invite.id}`)).status
    ).toBe('rejected');
  });

  it('stops resolving deleted invites', async () => {
    let { invite, key } = await createLinkInvite();
    let { user, client } = await signUp();

    expectOk(await org.clients.management.delete(`/organization/invites/${invite.id}`));

    expectError(
      await client.get('/dashboard/organization-join/find', { query: { invite_key: key } }),
      404,
      'not_found'
    );
    expectError(
      await client.post('/dashboard/organization-join/accept', { invite_key: key }),
      404,
      'not_found'
    );
    expect(await findMember(user.id)).toBeUndefined();
  });
});
