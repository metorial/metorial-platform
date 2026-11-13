import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { createScope, createToken, groundstation, rpcErrorCode } from './support';

describe('ingest tokens', () => {
  it('creates a token and returns the secret exactly once', async () => {
    let { organization, project, instance, token, secret } = await createToken({
      userRef: 'consumer_1',
      deviceRef: 'device_1',
      agentRef: 'client_1'
    });

    expect(token.object).toBe('groundstation#ingest_token');
    expect(token.organizationId).toBe(organization.id);
    expect(token.instance).toEqual({
      id: instance.id,
      ref: instance.ref,
      projectId: project.id
    });
    expect(token).toMatchObject({
      userRef: 'consumer_1',
      deviceRef: 'device_1',
      deviceMode: 'bound',
      agentRef: 'client_1',
      tags: []
    });
    expect(token.userEntityId).toMatch(/^gen_/);
    expect(token.deviceEntityId).toMatch(/^gen_/);
    expect(token.agentEntityId).toMatch(/^gen_/);
    expect(token.contentPolicy).toEqual({ defaultMode: 'basic' });
    expect(token.limits).toEqual({});
    expect(token.revokedAt).toBeNull();

    expect(secret.startsWith('metorial_agit_')).toBe(true);
    expect(secret).toContain(token.prefix);

    let fetched = await groundstation().ingestToken.get({
      organizationId: organization.id,
      ingestTokenId: token.id
    });

    expect(JSON.stringify(fetched)).not.toContain(secret);
    expect(Object.keys(fetched)).not.toContain('secret');
    expect(Object.keys(fetched)).not.toContain('secretHash');
  });

  it('creates an ephemeral token without a device', async () => {
    let { token } = await createToken({ deviceMode: 'ephemeral' });

    expect(token.deviceMode).toBe('ephemeral');
    expect(token.deviceRef).toBeNull();
    expect(token.deviceEntityId).toBeNull();
    expect(token.agentEntityId).toBeNull();
  });

  it('reuses the entities of an existing user and device', async () => {
    let first = await createToken({ userRef: 'consumer_1', deviceRef: 'device_1' });
    let second = await createToken({ userRef: 'consumer_1', deviceRef: 'device_1' }, first);
    let other = await createToken({ userRef: 'consumer_1', deviceRef: 'device_1' });

    expect(second.token.userEntityId).toBe(first.token.userEntityId);
    expect(second.token.deviceEntityId).toBe(first.token.deviceEntityId);
    expect(other.token.userEntityId).not.toBe(first.token.userEntityId);
  });

  it('requires a user and either a device or the ephemeral mode', async () => {
    let scope = await createScope();
    let base = {
      organizationId: scope.organization.id,
      instanceId: scope.instance.id,
      name: uniqueId('laptop')
    };

    let withoutUser = await rpcErrorCode(
      groundstation().ingestToken.create({
        ...base,
        deviceRef: 'device_1'
      } as Parameters<ReturnType<typeof groundstation>['ingestToken']['create']>[0])
    );
    let blankUser = await rpcErrorCode(
      groundstation().ingestToken.create({ ...base, userRef: '  ', deviceRef: 'device_1' })
    );
    let withoutDevice = await rpcErrorCode(
      groundstation().ingestToken.create({ ...base, userRef: 'consumer_1' })
    );
    let ephemeralWithDevice = await rpcErrorCode(
      groundstation().ingestToken.create({
        ...base,
        userRef: 'consumer_1',
        deviceRef: 'device_1',
        deviceMode: 'ephemeral'
      })
    );

    expect(withoutUser).toBe('invalid_data');
    expect([blankUser, withoutDevice, ephemeralWithDevice]).toEqual([
      'bad_request',
      'bad_request',
      'bad_request'
    ]);
  });

  it('validates tags', async () => {
    let tags = [
      { key: 'metorial.project', value: 'billing' },
      { key: 'acme.team-name', value: 'platform' }
    ];

    let { token } = await createToken({ tags });

    expect(token.tags).toEqual(tags);

    let scope = await createScope();
    let create = (tagInput: { key: string; value: string }[]) =>
      rpcErrorCode(
        groundstation().ingestToken.create({
          organizationId: scope.organization.id,
          instanceId: scope.instance.id,
          name: uniqueId('laptop'),
          userRef: 'consumer_1',
          deviceRef: 'device_1',
          tags: tagInput
        })
      );

    expect(await create([{ key: 'nodot', value: 'x' }])).toBe('invalid_data');
    expect(await create([{ key: 'Upper.case', value: 'x' }])).toBe('invalid_data');
    expect(await create([{ key: 'acme.team', value: '' }])).toBe('invalid_data');
    expect(
      await create(
        Array.from({ length: 21 }, (_, index) => ({ key: `acme.t${index}`, value: 'x' }))
      )
    ).toBe('invalid_data');
  });

  it('generates a distinct token every time', async () => {
    let scope = await createScope();

    let tokens = await Promise.all(Array.from({ length: 5 }, () => createToken({}, scope)));

    expect(new Set(tokens.map(token => token.secret)).size).toBe(5);
    expect(new Set(tokens.map(token => token.token.prefix)).size).toBe(5);
  });

  it('updates settings and the name but never the binding or tags', async () => {
    let { organization, token } = await createToken({
      tags: [{ key: 'metorial.project', value: 'billing' }]
    });

    let updated = await groundstation().ingestToken.update({
      organizationId: organization.id,
      ingestTokenId: token.id,
      name: 'renamed',
      contentPolicy: { defaultMode: 'full' },
      allowedClients: ['codex'],
      allowedChannels: ['hook'],
      ...({
        userRef: 'someone_else',
        deviceRef: 'another_device',
        tags: [{ key: 'metorial.project', value: 'hijacked' }]
      } as {})
    });

    expect(updated.name).toBe('renamed');
    expect(updated.contentPolicy).toEqual({ defaultMode: 'full' });
    expect(updated.allowedClients).toEqual(['codex']);
    expect(updated.allowedChannels).toEqual(['hook']);
    expect(updated).toMatchObject({
      userRef: token.userRef,
      deviceRef: token.deviceRef,
      userEntityId: token.userEntityId,
      deviceEntityId: token.deviceEntityId,
      tags: token.tags
    });
  });

  it('lists tokens with pagination and by instance', async () => {
    let scope = await createScope();
    let otherInstance = await groundstation().instance.upsert({
      organizationId: scope.organization.id,
      projectId: scope.project.id,
      ref: uniqueId('inst')
    });

    let created = [];
    for (let index = 0; index < 3; index++) {
      created.push((await createToken({}, scope)).token);
    }

    let elsewhere = await createToken({}, { ...scope, instance: otherInstance });

    let ids: string[] = [];
    let after: string | undefined;

    for (let page = 0; page < 5; page++) {
      let result = await groundstation().ingestToken.list({
        organizationId: scope.organization.id,
        instanceId: scope.instance.id,
        limit: 1,
        after
      });

      ids.push(...result.items.map(item => item.id));
      after = result.pagination.has_more_after ? result.items.at(-1)?.id : undefined;

      if (!after) break;
    }

    expect([...ids].sort()).toEqual(created.map(token => token.id).sort());

    let all = await groundstation().ingestToken.list({
      organizationId: scope.organization.id,
      limit: 10
    });

    expect(all.items.map(item => item.id)).toContain(elsewhere.token.id);
    expect(all.items).toHaveLength(4);
  });

  it('revokes a token idempotently and refuses updates afterwards', async () => {
    let { organization, token } = await createToken();
    let target = { organizationId: organization.id, ingestTokenId: token.id };

    let revoked = await groundstation().ingestToken.revoke(target);
    let again = await groundstation().ingestToken.revoke(target);

    expect(revoked.revokedAt).not.toBeNull();
    expect(again.revokedAt).toEqual(revoked.revokedAt);

    expect(
      await rpcErrorCode(groundstation().ingestToken.update({ ...target, name: 'x' }))
    ).toBe('precondition_failed');
  });

  it('rejects an expiry in the past', async () => {
    let code = await rpcErrorCode(createToken({ expiresAt: new Date(Date.now() - 60_000) }));

    expect(code).toBe('bad_request');
  });

  it('rejects invalid input', async () => {
    let scope = await createScope();

    let unknownChannel = await rpcErrorCode(
      createToken({ allowedChannels: ['nope' as 'hook'] }, scope)
    );
    let unknownMode = await rpcErrorCode(
      createToken({ contentPolicy: { defaultMode: 'everything' as 'full' } }, scope)
    );

    expect(unknownChannel).toBe('invalid_data');
    expect(unknownMode).toBe('invalid_data');
  });

  it('refuses tokens for an instance of another organization', async () => {
    let first = await createScope();
    let second = await createScope();

    let code = await rpcErrorCode(
      groundstation().ingestToken.create({
        organizationId: first.organization.id,
        instanceId: second.instance.id,
        name: uniqueId('laptop'),
        userRef: 'consumer_1',
        deviceRef: 'device_1'
      })
    );

    expect(code).toBe('not_found');
  });

  it('keeps tokens isolated between organizations', async () => {
    let first = await createToken();
    let second = await createToken();

    let get = await rpcErrorCode(
      groundstation().ingestToken.get({
        organizationId: second.organization.id,
        ingestTokenId: first.token.id
      })
    );
    let update = await rpcErrorCode(
      groundstation().ingestToken.update({
        organizationId: second.organization.id,
        ingestTokenId: first.token.id,
        name: 'hijacked'
      })
    );
    let revoke = await rpcErrorCode(
      groundstation().ingestToken.revoke({
        organizationId: second.organization.id,
        ingestTokenId: first.token.id
      })
    );

    expect([get, update, revoke]).toEqual(['not_found', 'not_found', 'not_found']);

    let list = await groundstation().ingestToken.list({
      organizationId: second.organization.id
    });
    expect(list.items.map(item => item.id)).toEqual([second.token.id]);

    let untouched = await groundstation().ingestToken.get({
      organizationId: first.organization.id,
      ingestTokenId: first.token.id
    });
    expect(untouched.name).toBe(first.token.name);
    expect(untouched.revokedAt).toBeNull();
  });

  it('does not find tokens of unknown organizations', async () => {
    let { token } = await createToken();

    let code = await rpcErrorCode(
      groundstation().ingestToken.get({
        organizationId: uniqueId('missing'),
        ingestTokenId: token.id
      })
    );

    expect(code).toBe('not_found');
  });
});
