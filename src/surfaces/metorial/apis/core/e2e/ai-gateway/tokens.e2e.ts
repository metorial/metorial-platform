import {
  eventuallyAudited,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueEmail,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { crossTenantClients, gatewayPath, ids } from './_shared';

describe('api-core ai-gateway: tokens', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let api = () => org.clients.instance;

  let createToken = async (body: Record<string, unknown> = {}) =>
    expectOk(await api().post('/ai-gateway/tokens', { name: uniqueId('token'), ...body }));

  let createConsumer = async () =>
    expectOk(
      await api().post('/consumers', {
        name: uniqueId('Consumer'),
        email: uniqueEmail('consumer')
      })
    );

  it('authenticates the token routes for every credential', async () => {
    let token = await createToken();
    let clients = crossTenantClients(org, otherOrg);
    let expected = {
      none: 401,
      session: 200,
      management: 200,
      instance: 200,
      otherSession: 404,
      otherManagement: 404,
      otherInstance: 404
    };

    await expectAuthMatrix(
      clients,
      (client, name) => client.get(gatewayPath(org, name, `/tokens/${token.id}`)),
      expected
    );
    await expectAuthMatrix(
      clients,
      (client, name) => client.get(gatewayPath(org, name, '/tokens')),
      { ...expected, otherInstance: 200 }
    );
    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.post(gatewayPath(org, name, '/tokens'), { name: uniqueId('token') }),
      { ...expected, otherInstance: 200 }
    );
  });

  it('creates a token whose secret is shown once', async () => {
    let created = await createToken({
      name: 'Support bot',
      allowed_models: ['anthropic/claude-haiku-5'],
      limits: [{ metric: 'requests', amount: 100, interval: '1h' }],
      metadata: { team: 'support', tier: 'free' }
    });

    expectPresented(created, 'ai_gateway.token');
    expect(created).toMatchObject({
      name: 'Support bot',
      allowed_models: ['anthropic/claude-haiku-5'],
      limits: [{ metric: 'requests', amount: 100, interval: '1h' }],
      metadata: { team: 'support', tier: 'free' },
      consumer: null,
      expires_at: null,
      revoked_at: null,
      last_used_at: null
    });
    expect(created.secret).toEqual(expect.any(String));
    expect(created.secret).toContain(`_${created.prefix}_`);

    let fetched = expectOk(await api().get(`/ai-gateway/tokens/${created.id}`));
    expect(fetched).toMatchObject({ id: created.id, name: 'Support bot', secret: null });

    let listed = await listAll(api(), '/ai-gateway/tokens');
    expect(listed.find(item => item.id == created.id)?.secret).toBeNull();
    expect(JSON.stringify([fetched, listed])).not.toContain(created.secret);
  });

  it('creates unrestricted tokens with sensible defaults', async () => {
    let created = await createToken();

    expect(created).toMatchObject({
      allowed_models: [],
      limits: [],
      metadata: {},
      consumer: null
    });
  });

  it('stores an expiry and lets it be cleared', async () => {
    let expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    let created = await createToken({ expires_at: expiresAt });
    expect(new Date(created.expires_at).toISOString()).toBe(expiresAt);

    let cleared = expectOk(
      await api().patch(`/ai-gateway/tokens/${created.id}`, { expires_at: null })
    );
    expect(cleared.expires_at).toBeNull();
  });

  it('updates a token and replaces lists and metadata', async () => {
    let created = await createToken({
      allowed_models: ['openai/gpt-6'],
      limits: [{ metric: 'tokens', amount: 5000, interval: '1d' }],
      metadata: { team: 'support' }
    });

    let updated = expectOk(
      await api().patch(`/ai-gateway/tokens/${created.id}`, {
        name: 'Renamed',
        allowed_models: [],
        limits: [{ metric: 'spend_usd', amount: 20, interval: '1mo' }],
        metadata: { team: 'billing' }
      })
    );
    expect(updated).toMatchObject({
      id: created.id,
      name: 'Renamed',
      allowed_models: [],
      limits: [{ metric: 'spend_usd', amount: 20, interval: '1mo' }],
      metadata: { team: 'billing' },
      secret: null
    });

    let untouched = expectOk(
      await api().patch(`/ai-gateway/tokens/${created.id}`, { name: 'Only the name' })
    );
    expect(untouched).toMatchObject({
      name: 'Only the name',
      limits: [{ metric: 'spend_usd', amount: 20, interval: '1mo' }],
      metadata: { team: 'billing' }
    });
  });

  it('revokes a token and keeps listing it', async () => {
    let created = await createToken();

    let revoked = expectOk(await api().post(`/ai-gateway/tokens/${created.id}/revoke`));
    expect(revoked.id).toBe(created.id);
    expect(revoked.revoked_at).toEqual(expect.any(String));

    let fetched = expectOk(await api().get(`/ai-gateway/tokens/${created.id}`));
    expect(fetched.revoked_at).toBe(revoked.revoked_at);

    let listed = await listAll(api(), '/ai-gateway/tokens');
    expect(listed.find(item => item.id == created.id)?.revoked_at).toBe(revoked.revoked_at);
  });

  describe('consumers', () => {
    it('embeds a consumer preview and never exposes the consumer reference', async () => {
      let consumer = await createConsumer();
      let created = await createToken({ consumer_id: consumer.id });

      expect(created.consumer).toEqual({
        object: 'consumer#preview',
        id: consumer.id,
        name: consumer.name,
        email: consumer.email
      });
      expect(created).not.toHaveProperty('consumer_ref');
      expect(created).not.toHaveProperty('consumer_id');

      let fetched = expectOk(await api().get(`/ai-gateway/tokens/${created.id}`));
      expect(fetched.consumer).toEqual(created.consumer);

      let updated = expectOk(
        await api().patch(`/ai-gateway/tokens/${created.id}`, { name: 'Still linked' })
      );
      expect(updated.consumer).toEqual(created.consumer);
    });

    it('embeds the right consumer on every token of a list', async () => {
      let first = await createConsumer();
      let second = await createConsumer();
      let tokens = [
        await createToken({ consumer_id: first.id }),
        await createToken({ consumer_id: second.id }),
        await createToken({ consumer_id: first.id }),
        await createToken()
      ];

      let listed = await listAll(api(), '/ai-gateway/tokens', { limit: 2 });
      let byId = new Map(listed.map(item => [item.id, item]));

      expect(byId.get(tokens[0]!.id)?.consumer?.id).toBe(first.id);
      expect(byId.get(tokens[1]!.id)?.consumer?.id).toBe(second.id);
      expect(byId.get(tokens[2]!.id)?.consumer?.id).toBe(first.id);
      expect(byId.get(tokens[3]!.id)?.consumer).toBeNull();
    });

    it('filters tokens by consumer', async () => {
      let consumer = await createConsumer();
      let other = await createConsumer();
      let mine = await createToken({ consumer_id: consumer.id });
      await createToken({ consumer_id: other.id });
      await createToken();

      let filtered = await listAll(api(), '/ai-gateway/tokens', {
        query: { consumer_id: consumer.id }
      });
      expect(ids(filtered)).toEqual([mine.id]);
    });

    it('answers 404 for a consumer that does not exist', async () => {
      expectError(
        await api().post('/ai-gateway/tokens', {
          name: uniqueId('token'),
          consumer_id: 'icon_doesnotexist'
        }),
        404
      );
      expectError(
        await api().get('/ai-gateway/tokens', { query: { consumer_id: 'icon_doesnotexist' } }),
        404
      );
    });

    it("rejects another organization's consumers", async () => {
      let foreign = expectOk(
        await otherOrg.clients.instance.post('/consumers', {
          name: uniqueId('Consumer'),
          email: uniqueEmail('consumer')
        })
      );

      expectError(
        await api().post('/ai-gateway/tokens', {
          name: uniqueId('token'),
          consumer_id: foreign.id
        }),
        404
      );
    });
  });

  describe('validation', () => {
    it('rejects invalid input on create', async () => {
      let invalid: Record<string, unknown>[] = [
        {},
        { name: '' },
        { name: 'x'.repeat(201) },
        { name: uniqueId('token'), allowed_models: [''] },
        {
          name: uniqueId('token'),
          limits: [{ metric: 'bananas', amount: 1, interval: '1h' }]
        },
        {
          name: uniqueId('token'),
          limits: [{ metric: 'requests', amount: 0, interval: '1h' }]
        },
        {
          name: uniqueId('token'),
          limits: [{ metric: 'requests', amount: 1, interval: '1y' }]
        },
        { name: uniqueId('token'), metadata: { team: 5 } },
        { name: uniqueId('token'), expires_at: 'tomorrow' }
      ];

      for (let body of invalid) {
        expectError(await api().post('/ai-gateway/tokens', body), 400, 'invalid_data');
      }
    });

    it('rejects invalid input on update', async () => {
      let created = await createToken();

      for (let body of [
        { name: '' },
        { limits: [{ metric: 'requests', amount: -1, interval: '1h' }] },
        { metadata: { team: ['support'] } }
      ]) {
        expectError(
          await api().patch(`/ai-gateway/tokens/${created.id}`, body),
          400,
          'invalid_data'
        );
      }
    });
  });

  describe('lookups', () => {
    it('answers 404 for tokens that do not exist or belong to another organization', async () => {
      let foreign = expectOk(
        await otherOrg.clients.instance.post('/ai-gateway/tokens', { name: uniqueId('token') })
      );

      for (let id of ['agtk_doesnotexist', foreign.id]) {
        expectError(await api().get(`/ai-gateway/tokens/${id}`), 404);
        expectError(await api().patch(`/ai-gateway/tokens/${id}`, { name: 'Taken' }), 404);
        expectError(await api().post(`/ai-gateway/tokens/${id}/revoke`), 404);
      }

      let theirs = await listAll(otherOrg.clients.instance, '/ai-gateway/tokens');
      expect(theirs.find(item => item.id == foreign.id)?.revoked_at).toBeNull();
    });

    it('pages through every token without duplicates', async () => {
      let created = [await createToken(), await createToken(), await createToken()];

      let all = await listAll(api(), '/ai-gateway/tokens');
      let paged = await listAll(api(), '/ai-gateway/tokens', { limit: 1 });

      expect(ids(paged)).toEqual(ids(all));
      expect(new Set(ids(paged)).size).toBe(paged.length);
      expect(ids(paged)).toEqual(expect.arrayContaining(ids(created)));
    });

    it("keeps tokens out of another organization's list", async () => {
      let mine = await createToken();

      let theirs = await listAll(otherOrg.clients.instance, '/ai-gateway/tokens');
      expect(ids(theirs)).not.toContain(mine.id);
    });
  });

  describe('audit trail', () => {
    it('records token changes without the secret', async () => {
      let created = await createToken({ name: 'Audited' });
      expectOk(await api().patch(`/ai-gateway/tokens/${created.id}`, { name: 'Audited 2' }));
      expectOk(await api().post(`/ai-gateway/tokens/${created.id}/revoke`));

      let entries = await eventuallyAudited(async () => {
        let auditLogs = await listAll(org.clients.management, '/organization/audit-logs');
        let entries = auditLogs.filter(
          item => item.resource == 'ai_gateway_token' && item.payload?.id == created.id
        );
        expect(entries.map(item => item.action).sort()).toEqual([
          'create',
          'revoke',
          'update'
        ]);
        return entries;
      });

      expect(entries.find(item => item.action == 'create')?.payload).toMatchObject({
        id: created.id,
        name: 'Audited'
      });
      expect(JSON.stringify(entries)).not.toContain(created.secret);
    }, 180_000);
  });
});
