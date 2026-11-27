import {
  expectAuthMatrix,
  expectError,
  expectOk,
  listAll,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { crossTenantClients, gatewayPath } from './_shared';

let range = () => {
  let to = new Date();
  let from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
};

describe('api-core ai-gateway: inference logs and usage', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let api = () => org.clients.instance;
  let admin = () => org.clients.management;
  let at = (path: string) => gatewayPath(org, 'management', path);

  describe('inference logs', () => {
    it('authenticates the list for every credential', async () => {
      await expectAuthMatrix(
        crossTenantClients(org, otherOrg),
        (client, name) => client.get(gatewayPath(org, name, '/inference-logs')),
        {
          none: 401,
          session: 200,
          management: 200,
          instance: 403,
          otherSession: 404,
          otherManagement: 404,
          otherInstance: 403
        }
      );
    });

    it('starts empty', async () => {
      expect(await listAll(admin(), at('/inference-logs'))).toEqual([]);
    });

    it('accepts every filter', async () => {
      let token = expectOk(
        await api().post('/ai-gateway/tokens', { name: uniqueId('token') })
      );

      for (let status of ['succeeded', 'failed', 'cancelled', 'rejected']) {
        expect(await listAll(admin(), at('/inference-logs'), { query: { status } })).toEqual(
          []
        );
      }
      expect(
        await listAll(admin(), at('/inference-logs'), { query: { token_id: token.id } })
      ).toEqual([]);
      expect(
        await listAll(admin(), at('/inference-logs'), {
          query: { model: 'anthropic/claude-sonnet-5' }
        })
      ).toEqual([]);
    });

    it('rejects an unknown status', async () => {
      expectError(
        await admin().get(at('/inference-logs'), { query: { status: 'sleeping' } }),
        400,
        'invalid_data'
      );
    });

    it('answers 404 for a log that does not exist', async () => {
      expectError(await admin().get(at('/inference-logs/agil_doesnotexist')), 404);
      expectError(
        await admin().get(at('/inference-logs/agil_doesnotexist'), {
          query: { include_content: 'true' }
        }),
        404
      );
    });

    it('answers 404 for a consumer that does not exist', async () => {
      expectError(
        await admin().get(at('/inference-logs'), {
          query: { consumer_id: 'consumer_doesnotexist' }
        }),
        404
      );
    });
  });

  describe('usage', () => {
    it('authenticates the timeline for every credential', async () => {
      await expectAuthMatrix(
        crossTenantClients(org, otherOrg),
        (client, name) =>
          client.get(gatewayPath(org, name, '/usage/timeline'), { query: range() }),
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

    it('returns an empty timeline for an instance without traffic', async () => {
      let usage = expectOk(
        await api().get('/ai-gateway/usage/timeline', {
          query: { ...range(), interval: '1h' }
        })
      );

      expect(usage.object).toBe('ai_gateway.usage_timeline');
      expect(usage.interval).toBe('1h');
      expect(Array.isArray(usage.buckets)).toBe(true);
      for (let bucket of usage.buckets) {
        expect(bucket.requests ?? 0).toBe(0);
      }
    });

    it('picks an interval when none is given', async () => {
      let usage = expectOk(await api().get('/ai-gateway/usage/timeline', { query: range() }));

      expect(['5m', '15m', '1h', '6h', '1d']).toContain(usage.interval);
      expect(usage.buckets.length).toBeLessThanOrEqual(500);
    });

    it('accepts every filter', async () => {
      let token = expectOk(
        await api().post('/ai-gateway/tokens', { name: uniqueId('token') })
      );

      expectOk(
        await api().get('/ai-gateway/usage/timeline', {
          query: {
            ...range(),
            token_id: token.id,
            model: 'anthropic/claude-sonnet-5',
            virtual_model_id: 'agvm_doesnotexist'
          }
        })
      );
    });

    it('rejects invalid ranges and intervals', async () => {
      let { from, to } = range();

      for (let query of [
        {},
        { from },
        { to },
        { from: 'yesterday', to },
        { from, to, interval: '2h' },
        { from: to, to: from },
        { from, to: from }
      ]) {
        expectError(await api().get('/ai-gateway/usage/timeline', { query }), 400);
      }
    });

    it('rejects a range that would need too many buckets', async () => {
      let to = new Date();
      let from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

      expectError(
        await api().get('/ai-gateway/usage/timeline', {
          query: { from: from.toISOString(), to: to.toISOString(), interval: '5m' }
        }),
        400
      );
    });

    it('answers 404 for a consumer that does not exist', async () => {
      expectError(
        await api().get('/ai-gateway/usage/timeline', {
          query: { ...range(), consumer_id: 'consumer_doesnotexist' }
        }),
        404
      );
    });
  });
});
