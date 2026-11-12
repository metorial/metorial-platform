import { beforeEach, describe, expect, it } from 'vitest';
import { ingestFetch } from '../../ingest';
import { ingestTokenService, tenantService } from '../../services';
import { cleanDatabase, testDb } from '../../test/setup';
import { eventually, expectServiceError, sleep } from '../../test/helpers';
import { ingestTokenPresenter } from '../../presenters';
import { parseIngestToken } from '../tokenSecret';
import { verifyIngestCredential } from '../verify';

let createTenant = (ref: string = `org_${crypto.randomUUID()}`) =>
  tenantService.upsertTenant({ input: { ref } });

let createToken = async (
  input: Partial<Parameters<typeof ingestTokenService.createIngestToken>[0]['input']> = {}
) => {
  let tenant = await createTenant();

  let created = await ingestTokenService.createIngestToken({
    tenant,
    input: { name: 'laptop', ...input }
  });

  return { tenant, ...created };
};

let ingest = (
  path: string,
  credential: string | undefined,
  headers: Record<string, string> = {}
) =>
  ingestFetch(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(credential ? { authorization: `Bearer ${credential}` } : {}),
        ...headers
      },
      body: '{}'
    })
  );

describe('tenant service', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a tenant with defaults and updates it by ref', async () => {
    let created = await tenantService.upsertTenant({ input: { ref: 'org_a' } });

    expect(created.skewBoundSeconds).toBe(86400);
    expect(created.backfillMaxAgeDays).toBeNull();

    let updated = await tenantService.upsertTenant({
      input: { ref: 'org_a', skewBoundSeconds: 600, backfillMaxAgeDays: 30 }
    });

    expect(updated.id).toBe(created.id);
    expect(updated.skewBoundSeconds).toBe(600);
    expect(updated.backfillMaxAgeDays).toBe(30);

    let untouched = await tenantService.upsertTenant({ input: { ref: 'org_a' } });

    expect(untouched.skewBoundSeconds).toBe(600);
    expect(untouched.backfillMaxAgeDays).toBe(30);

    let cleared = await tenantService.upsertTenant({
      input: { ref: 'org_a', backfillMaxAgeDays: null }
    });

    expect(cleared.backfillMaxAgeDays).toBeNull();
  });

  it('finds a tenant by id or ref', async () => {
    let tenant = await createTenant('org_b');

    expect((await tenantService.getTenantById({ id: tenant.id })).oid).toBe(tenant.oid);
    expect((await tenantService.getTenantById({ id: 'org_b' })).oid).toBe(tenant.oid);

    await expectServiceError(tenantService.getTenantById({ id: 'missing' }), 'not_found');
  });
});

describe('ingest token service', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('stores only a hash of the secret and returns the token once', async () => {
    let { ingestToken, secret } = await createToken();

    expect(secret.startsWith('metorial_agit_')).toBe(true);
    expect(secret).toContain(ingestToken.prefix);
    expect(ingestToken.secretHash).not.toContain(parseIngestToken(secret)!.secret);
    expect(ingestToken.contentPolicy).toEqual({ defaultMode: 'basic' });
    expect(ingestToken.limits).toEqual({});

    let stored = await testDb.ingestToken.findUniqueOrThrow({ where: { id: ingestToken.id } });

    let storedValues = Object.values(stored).map(value =>
      JSON.stringify(value, (_, v) => (typeof v == 'bigint' ? String(v) : v))
    );

    expect(storedValues.join(' ')).not.toContain(parseIngestToken(secret)!.secret);
  });

  it('never presents the secret hash', async () => {
    let { ingestToken } = await createToken();

    let presented = ingestTokenPresenter(ingestToken);

    expect(Object.keys(presented)).not.toContain('secretHash');
    expect(JSON.stringify(presented)).not.toContain(ingestToken.secretHash);
  });

  it('scopes get and list to the tenant', async () => {
    let first = await createToken();
    let second = await createToken();

    let found = await ingestTokenService.getIngestTokenById({
      id: first.ingestToken.id,
      tenant: first.tenant
    });
    expect(found.id).toBe(first.ingestToken.id);

    await expectServiceError(
      ingestTokenService.getIngestTokenById({
        id: first.ingestToken.id,
        tenant: second.tenant
      }),
      'not_found'
    );

    let paginator = await ingestTokenService.listIngestTokens({ tenant: first.tenant });
    let page = await paginator.run({ limit: 10 });

    expect(page.items.map(item => item.id)).toEqual([first.ingestToken.id]);
  });

  it('rejects an expiry in the past', async () => {
    let tenant = await createTenant();

    await expectServiceError(
      ingestTokenService.createIngestToken({
        tenant,
        input: { name: 'old', expiresAt: new Date(Date.now() - 1000) }
      }),
      'bad_request'
    );
  });

  it('refuses to update a revoked token and revoking is idempotent', async () => {
    let { ingestToken } = await createToken();

    let revoked = await ingestTokenService.revokeIngestToken({ ingestToken });
    let again = await ingestTokenService.revokeIngestToken({ ingestToken: revoked });

    expect(revoked.revokedAt).toBeInstanceOf(Date);
    expect(again.revokedAt?.getTime()).toBe(revoked.revokedAt?.getTime());

    await expectServiceError(
      ingestTokenService.updateIngestToken({
        ingestToken: revoked,
        input: { name: 'renamed' }
      }),
      'precondition_failed'
    );
  });
});

describe('ingest credential verification', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('resolves a principal with tenant settings and token policy', async () => {
    let { tenant, ingestToken, secret } = await createToken({
      principalRef: 'user_1',
      contentPolicy: { defaultMode: 'shape', roles: { prompt: 'full' } },
      limits: { itemsPerSecond: 50 },
      allowedClients: ['claude-code'],
      allowedChannels: ['hook']
    });

    let principal = await verifyIngestCredential(secret);

    expect(principal).toEqual({
      tokenId: ingestToken.id,
      principalRef: 'user_1',
      contentPolicy: { defaultMode: 'shape', roles: { prompt: 'full' } },
      limits: { itemsPerSecond: 50 },
      allowedClients: ['claude-code'],
      allowedChannels: ['hook'],
      tenant: {
        id: tenant.id,
        ref: tenant.ref,
        skewBoundSeconds: 86400,
        backfillMaxAgeDays: null,
        hashKeyVersion: 1,
        recordRetentionDays: 90,
        contentRetentionDays: 30,
        contentKeyVersion: 1
      }
    });
  });

  it('rejects unknown tokens, wrong secrets and missing credentials', async () => {
    let { ingestToken, secret } = await createToken();
    let { prefix } = parseIngestToken(secret)!;

    let wrongSecret = `metorial_agit_${prefix}_${'A'.repeat(43)}`;
    let unknown = `metorial_agit_${'B'.repeat(11)}_${'C'.repeat(43)}`;

    await expectServiceError(verifyIngestCredential(wrongSecret), 'invalid_credential');
    await expectServiceError(verifyIngestCredential(unknown), 'invalid_credential');
    await expectServiceError(verifyIngestCredential(undefined), 'missing_credential');

    expect(ingestToken.prefix).toBe(prefix);
    await expect(verifyIngestCredential(secret)).resolves.toBeDefined();
  });

  it('stops accepting a token right after it is revoked, even when cached', async () => {
    let { ingestToken, secret } = await createToken();

    await verifyIngestCredential(secret);
    await verifyIngestCredential(secret);

    await ingestTokenService.revokeIngestToken({ ingestToken });

    await expectServiceError(verifyIngestCredential(secret), 'invalid_credential');
  });

  it('stops accepting a token once it expires', async () => {
    let { secret } = await createToken({ expiresAt: new Date(Date.now() + 1500) });

    await expect(verifyIngestCredential(secret)).resolves.toBeDefined();

    await sleep(1700);

    await expectServiceError(verifyIngestCredential(secret), 'invalid_credential');
  });

  it('applies token updates immediately', async () => {
    let { tenant, ingestToken, secret } = await createToken();

    expect((await verifyIngestCredential(secret)).contentPolicy.defaultMode).toBe('basic');

    await ingestTokenService.updateIngestToken({
      ingestToken,
      input: { contentPolicy: { defaultMode: 'full' }, allowedClients: ['codex'] }
    });

    let principal = await verifyIngestCredential(secret);

    expect(principal.contentPolicy.defaultMode).toBe('full');
    expect(principal.allowedClients).toEqual(['codex']);
    expect(principal.tenant.id).toBe(tenant.id);
  });

  it('applies tenant setting changes to cached tokens', async () => {
    let { tenant, secret } = await createToken();

    expect((await verifyIngestCredential(secret)).tenant.skewBoundSeconds).toBe(86400);

    await tenantService.upsertTenant({ input: { ref: tenant.ref, skewBoundSeconds: 120 } });

    expect((await verifyIngestCredential(secret)).tenant.skewBoundSeconds).toBe(120);
  });

  it('records last use without blocking the request', async () => {
    let { ingestToken, secret } = await createToken();

    expect(ingestToken.lastUsedAt).toBeNull();

    await verifyIngestCredential(secret);

    await eventually(async () => {
      let stored = await testDb.ingestToken.findUniqueOrThrow({
        where: { id: ingestToken.id }
      });

      expect(stored.lastUsedAt).toBeInstanceOf(Date);
    });
  });
});

describe('authenticated ingest routes', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('lets a valid token through to the handler', async () => {
    let { secret } = await createToken();

    expect((await ingest('/v1/logs', secret)).status).toBe(200);
    expect((await ingest('/v1/logs', undefined, { 'x-api-key': secret })).status).toBe(200);
  });

  it('answers 401 with a challenge for bad credentials', async () => {
    let { ingestToken, secret } = await createToken();

    let unknown = await ingest(
      '/v1/logs',
      `metorial_agit_${'B'.repeat(11)}_${'C'.repeat(43)}`
    );

    expect(unknown.status).toBe(401);
    expect(unknown.headers.get('www-authenticate')).toContain('Bearer');

    await ingestTokenService.revokeIngestToken({ ingestToken });

    expect((await ingest('/v1/logs', secret)).status).toBe(401);
  });

  it('keeps ping and the dialect list public', async () => {
    let ping = await ingestFetch(new Request('http://localhost/ping'));
    let dialects = await ingestFetch(new Request('http://localhost/v1/bulk/dialects'));

    expect(ping.status).toBe(200);
    expect(dialects.status).toBe(200);
  });

  it('enforces allowed clients on hook routes', async () => {
    let { secret } = await createToken({ allowedClients: ['codex'] });

    let denied = await ingest('/v1/ingest/hooks/claude-code', secret);
    let body = (await denied.json()) as { code: string };

    expect(denied.status).toBe(403);
    expect(body.code).toBe('client_not_allowed');
    expect((await ingest('/v1/ingest/hooks/codex', secret)).status).toBe(200);
  });

  it('enforces allowed channels', async () => {
    let { secret } = await createToken({ allowedChannels: ['otlp.logs'] });

    let denied = await ingest('/v1/traces', secret);
    let body = (await denied.json()) as { code: string };

    expect(denied.status).toBe(403);
    expect(body.code).toBe('channel_not_allowed');
    expect((await ingest('/v1/logs', secret)).status).toBe(200);
    expect((await ingest('/v1/ingest/hooks/codex', secret)).status).toBe(403);
  });
});
