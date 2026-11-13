import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { createScope, createToken, groundstation, rpcErrorCode } from './support';

describe('user erasure', () => {
  it('revokes the tokens of a bound user and anonymizes it', async () => {
    let { organization, token } = await createToken({ deviceMode: 'ephemeral' });

    await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'user',
      source: 'metorial.consumer',
      ref: token.userRef,
      name: 'Ada',
      identifiers: [{ type: 'email', value: `${uniqueId('ada')}@acme.com` }]
    });

    let erased = await groundstation().user.erase({
      organizationId: organization.id,
      userId: token.userEntityId
    });
    expect(erased).toEqual({ userId: token.userEntityId, erasing: true });

    let revoked = await groundstation().ingestToken.get({
      organizationId: organization.id,
      ingestTokenId: token.id
    });
    expect(revoked.revokedAt).not.toBeNull();

    await eventually(async () => {
      let user = await groundstation().entity.get({
        organizationId: organization.id,
        entityId: token.userEntityId
      });

      expect(user).toMatchObject({ status: 'archived', name: null, identifiers: [] });
    });
  });

  it('deletes a user no token is bound to', async () => {
    let { organization } = await createScope();

    let user = await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'user',
      identifiers: [{ type: 'account:cursor', value: uniqueId('vendor') }]
    });

    await groundstation().user.erase({ organizationId: organization.id, userId: user.id });

    await eventually(async () => {
      expect(
        await rpcErrorCode(
          groundstation().entity.get({ organizationId: organization.id, entityId: user.id })
        )
      ).toBe('not_found');
    });
  });

  it('rejects entities that are not users and unknown ids', async () => {
    let { organization } = await createScope();
    let other = await createScope();

    let team = await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'team',
      ref: uniqueId('team')
    });
    let foreign = await groundstation().entity.upsert({
      organizationId: other.organization.id,
      kind: 'user',
      identifiers: [{ type: 'account:cursor', value: uniqueId('vendor') }]
    });

    let erase = (userId: string) =>
      rpcErrorCode(groundstation().user.erase({ organizationId: organization.id, userId }));

    expect(await erase(team.id)).toBe('bad_request');
    expect(await erase(foreign.id)).toBe('not_found');
    expect(await erase('gen_missing')).toBe('not_found');
  });
});
