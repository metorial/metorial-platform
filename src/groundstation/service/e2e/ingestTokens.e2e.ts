import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { createTenant, createToken, groundstation, rpcErrorCode } from './support';

describe('ingest tokens', () => {
  it('creates a token and returns the secret exactly once', async () => {
    let { tenant, token, secret } = await createToken({ principalRef: 'user_1' });

    expect(token.object).toBe('groundstation#ingest_token');
    expect(token.tenantRef).toBe(tenant.ref);
    expect(token.principalRef).toBe('user_1');
    expect(token.contentPolicy).toEqual({ defaultMode: 'basic' });
    expect(token.limits).toEqual({});
    expect(token.revokedAt).toBeNull();

    expect(secret.startsWith('metorial_agit_')).toBe(true);
    expect(secret).toContain(token.prefix);

    let fetched = await groundstation().ingestToken.get({
      tenantId: tenant.id,
      ingestTokenId: token.id
    });

    expect(JSON.stringify(fetched)).not.toContain(secret);
    expect(Object.keys(fetched)).not.toContain('secret');
    expect(Object.keys(fetched)).not.toContain('secretHash');
  });

  it('generates a distinct token every time', async () => {
    let tenant = await createTenant();

    let tokens = await Promise.all(
      Array.from({ length: 5 }, () =>
        groundstation().ingestToken.create({ tenantId: tenant.id, name: uniqueId('laptop') })
      )
    );

    expect(new Set(tokens.map(token => token.secret)).size).toBe(5);
    expect(new Set(tokens.map(token => token.prefix)).size).toBe(5);
  });

  it('updates settings and the name', async () => {
    let { tenant, token } = await createToken();

    let updated = await groundstation().ingestToken.update({
      tenantId: tenant.id,
      ingestTokenId: token.id,
      name: 'renamed',
      contentPolicy: { defaultMode: 'full' },
      allowedClients: ['codex'],
      allowedChannels: ['hook']
    });

    expect(updated.name).toBe('renamed');
    expect(updated.contentPolicy).toEqual({ defaultMode: 'full' });
    expect(updated.allowedClients).toEqual(['codex']);
    expect(updated.allowedChannels).toEqual(['hook']);
  });

  it('lists tokens with pagination', async () => {
    let tenant = await createTenant();

    let created = [];
    for (let index = 0; index < 3; index++) {
      created.push(
        await groundstation().ingestToken.create({
          tenantId: tenant.id,
          name: uniqueId('laptop')
        })
      );
    }

    let ids: string[] = [];
    let after: string | undefined;

    for (let page = 0; page < 5; page++) {
      let result = await groundstation().ingestToken.list({
        tenantId: tenant.id,
        limit: 1,
        after
      });

      ids.push(...result.items.map(item => item.id));
      after = result.pagination.has_more_after ? result.items.at(-1)?.id : undefined;

      if (!after) break;
    }

    expect([...ids].sort()).toEqual(created.map(token => token.id).sort());
  });

  it('revokes a token idempotently and refuses updates afterwards', async () => {
    let { tenant, token } = await createToken();
    let target = { tenantId: tenant.id, ingestTokenId: token.id };

    let revoked = await groundstation().ingestToken.revoke(target);
    let again = await groundstation().ingestToken.revoke(target);

    expect(revoked.revokedAt).not.toBeNull();
    expect(again.revokedAt).toEqual(revoked.revokedAt);

    expect(
      await rpcErrorCode(groundstation().ingestToken.update({ ...target, name: 'x' }))
    ).toBe('precondition_failed');
  });

  it('rejects an expiry in the past', async () => {
    let tenant = await createTenant();

    let code = await rpcErrorCode(
      groundstation().ingestToken.create({
        tenantId: tenant.id,
        name: uniqueId('old'),
        expiresAt: new Date(Date.now() - 60_000)
      })
    );

    expect(code).toBe('bad_request');
  });

  it('rejects invalid input', async () => {
    let tenant = await createTenant();

    let unknownChannel = await rpcErrorCode(
      groundstation().ingestToken.create({
        tenantId: tenant.id,
        name: uniqueId('laptop'),
        allowedChannels: ['nope' as 'hook']
      })
    );
    let unknownMode = await rpcErrorCode(
      groundstation().ingestToken.create({
        tenantId: tenant.id,
        name: uniqueId('laptop'),
        contentPolicy: { defaultMode: 'everything' as 'full' }
      })
    );

    expect(unknownChannel).toBe('invalid_data');
    expect(unknownMode).toBe('invalid_data');
  });

  it('keeps tokens isolated between tenants', async () => {
    let first = await createToken();
    let second = await createToken();

    let get = await rpcErrorCode(
      groundstation().ingestToken.get({
        tenantId: second.tenant.id,
        ingestTokenId: first.token.id
      })
    );
    let update = await rpcErrorCode(
      groundstation().ingestToken.update({
        tenantId: second.tenant.id,
        ingestTokenId: first.token.id,
        name: 'hijacked'
      })
    );
    let revoke = await rpcErrorCode(
      groundstation().ingestToken.revoke({
        tenantId: second.tenant.id,
        ingestTokenId: first.token.id
      })
    );

    expect([get, update, revoke]).toEqual(['not_found', 'not_found', 'not_found']);

    let list = await groundstation().ingestToken.list({ tenantId: second.tenant.id });
    expect(list.items.map(item => item.id)).toEqual([second.token.id]);

    let untouched = await groundstation().ingestToken.get({
      tenantId: first.tenant.id,
      ingestTokenId: first.token.id
    });
    expect(untouched.name).toBe(first.token.name);
    expect(untouched.revokedAt).toBeNull();
  });

  it('does not find tokens of unknown tenants', async () => {
    let { token } = await createToken();

    let code = await rpcErrorCode(
      groundstation().ingestToken.get({
        tenantId: uniqueId('missing'),
        ingestTokenId: token.id
      })
    );

    expect(code).toBe('not_found');
  });
});
