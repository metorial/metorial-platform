import {
  expectAuthMatrix,
  expectError,
  expectOk,
  listAll,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import { crossTenantClients, ensureCatalog, gatewayPath } from './_shared';

let missingId = 'agpc_doesnotexist';

describe('api-core ai-gateway: provider connections', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let api = () => org.clients.instance;

  beforeAll(async () => {
    await ensureCatalog();
  });

  it('authenticates the list for every credential', async () => {
    await expectAuthMatrix(
      crossTenantClients(org, otherOrg),
      (client, name) => client.get(gatewayPath(org, name, '/provider-connections')),
      {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 200
      }
    );
  });

  it('starts without any provider connection', async () => {
    expect(await listAll(api(), '/ai-gateway/provider-connections')).toEqual([]);
  });

  it('answers 404 for connections that do not exist', async () => {
    let path = `/ai-gateway/provider-connections/${missingId}`;

    expectError(await api().get(path), 404);
    expectError(await api().patch(path, { name: 'Renamed' }), 404);
    expectError(await api().delete(path), 404);
    expectError(await api().post(`${path}/enable`, {}), 404);
    expectError(await api().post(`${path}/disable`, {}), 404);
    expectError(await api().post(`${path}/check`, {}), 404);
  });

  describe('create validation', () => {
    let valid = () => ({
      provider: 'anthropic',
      name: uniqueId('connection'),
      credentials: { apiKey: 'sk-ant-e2e-not-a-real-key' }
    });

    it('rejects malformed bodies before contacting a provider', async () => {
      for (let invalid of [
        { provider: undefined },
        { name: undefined },
        { credentials: undefined },
        { name: '' },
        { name: 'x'.repeat(201) },
        { description: 'x'.repeat(2001) },
        { priority: 1001 },
        { priority: -1001 },
        { priority: 1.5 },
        { credentials: { apiKey: 'x'.repeat(8193) } },
        { config: { nested: { not: 'allowed' } } }
      ]) {
        expectError(
          await api().post('/ai-gateway/provider-connections', { ...valid(), ...invalid }),
          400,
          'invalid_data'
        );
      }
    });

    it('rejects a provider that does not exist', async () => {
      let response = await api().post('/ai-gateway/provider-connections', {
        ...valid(),
        provider: 'no-such-provider'
      });

      expect(response.status, response.text).toBeGreaterThanOrEqual(400);
      expect(response.status, response.text).toBeLessThan(500);
    });

    it('rejects credentials that do not fit the provider', async () => {
      let response = await api().post('/ai-gateway/provider-connections', {
        ...valid(),
        credentials: { unexpected: 'field' }
      });

      expect(response.status, response.text).toBe(400);
    });

    it('leaves nothing behind after a rejected create', async () => {
      expect(await listAll(api(), '/ai-gateway/provider-connections')).toEqual([]);
    });
  });
});
