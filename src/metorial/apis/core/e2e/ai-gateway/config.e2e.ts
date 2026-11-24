import {
  eventuallyAudited,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { crossTenantClients, gatewayPath } from './_shared';

describe('api-core ai-gateway: config', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let auditOrg = useOrganization();

  let api = () => org.clients.instance;

  it('authenticates the config routes for every credential', async () => {
    let clients = crossTenantClients(org, otherOrg);
    let expected = {
      none: 401,
      session: 200,
      management: 200,
      instance: 200,
      otherSession: 404,
      otherManagement: 404,
      otherInstance: 200
    };

    await expectAuthMatrix(
      clients,
      (client, name) => client.get(gatewayPath(org, name, '/config')),
      expected
    );
    await expectAuthMatrix(
      clients,
      (client, name) => client.patch(gatewayPath(org, name, '/config'), {}),
      expected
    );
  });

  it('starts with the documented defaults', async () => {
    let config = expectOk(await api().get('/ai-gateway/config'));

    expectPresented(config, 'ai_gateway.config');
    expect(config.settings).toEqual({
      content_logging: { enabled: false, retention_days: 7 },
      metorial_provider: { enabled: true },
      fallbacks: { enabled: true },
      zero_data_retention: { required: false }
    });
    expect(config.limits).toEqual([]);
    expect(config.log_retention_days).toEqual(expect.any(Number));
    expect(config.disabled).toBeNull();
    expect(config.billing_restriction).toBeNull();
    expect(Array.isArray(config.plan_limits)).toBe(true);
  });

  it('changes a single setting and keeps the others', async () => {
    let changed = expectOk(
      await api().patch('/ai-gateway/config', {
        settings: { content_logging: { enabled: true } }
      })
    );
    expect(changed.settings.content_logging).toEqual({ enabled: true, retention_days: 7 });

    let again = expectOk(
      await api().patch('/ai-gateway/config', {
        settings: { content_logging: { retention_days: 30 }, fallbacks: { enabled: false } }
      })
    );
    expect(again.settings).toEqual({
      content_logging: { enabled: true, retention_days: 30 },
      metorial_provider: { enabled: true },
      fallbacks: { enabled: false },
      zero_data_retention: { required: false }
    });

    let fetched = expectOk(await api().get('/ai-gateway/config'));
    expect(fetched.settings).toEqual(again.settings);
  });

  it('updates the log retention and the limits, and replaces the limits as a whole', async () => {
    let first = expectOk(
      await api().patch('/ai-gateway/config', {
        log_retention_days: 45,
        limits: [
          { metric: 'requests', amount: 1000, interval: '1h' },
          { metric: 'spend_usd', amount: 50, interval: '1d' }
        ]
      })
    );
    expect(first.log_retention_days).toBe(45);
    expect(first.limits).toEqual([
      { metric: 'requests', amount: 1000, interval: '1h' },
      { metric: 'spend_usd', amount: 50, interval: '1d' }
    ]);

    let second = expectOk(
      await api().patch('/ai-gateway/config', {
        limits: [{ metric: 'tokens', amount: 1_000_000, interval: '1mo' }]
      })
    );
    expect(second.log_retention_days).toBe(45);
    expect(second.limits).toEqual([{ metric: 'tokens', amount: 1_000_000, interval: '1mo' }]);

    let cleared = expectOk(await api().patch('/ai-gateway/config', { limits: [] }));
    expect(cleared.limits).toEqual([]);
  });

  it('leaves everything alone for an empty update', async () => {
    let before = expectOk(await api().get('/ai-gateway/config'));
    let after = expectOk(await api().patch('/ai-gateway/config', {}));

    expect(after.settings).toEqual(before.settings);
    expect(after.limits).toEqual(before.limits);
    expect(after.log_retention_days).toBe(before.log_retention_days);
  });

  it('keeps settings separate per instance and organization', async () => {
    expectOk(
      await api().patch('/ai-gateway/config', {
        settings: { zero_data_retention: { required: true } }
      })
    );

    let theirs = expectOk(await otherOrg.clients.instance.get('/ai-gateway/config'));
    expect(theirs.settings.zero_data_retention.required).toBe(false);
  });

  it('rejects invalid input', async () => {
    let invalid: Record<string, unknown>[] = [
      { log_retention_days: 0 },
      { log_retention_days: 401 },
      { log_retention_days: 1.5 },
      { settings: { content_logging: { retention_days: 0 } } },
      { settings: { content_logging: { retention_days: 91 } } },
      { settings: { content_logging: { enabled: 'yes' } } },
      { settings: { fallbacks: { enabled: 1 } } },
      { limits: [{ metric: 'requests', amount: 0, interval: '1h' }] },
      { limits: [{ metric: 'requests', amount: 10, interval: '1w' }] },
      {
        limits: Array.from({ length: 13 }, () => ({
          metric: 'requests',
          amount: 1,
          interval: '1h'
        }))
      }
    ];

    for (let body of invalid) {
      expectError(await api().patch('/ai-gateway/config', body), 400, 'invalid_data');
    }
  });

  it('records configuration changes in the audit log', async () => {
    expectOk(
      await auditOrg.clients.instance.patch('/ai-gateway/config', { log_retention_days: 60 })
    );

    let entry = await eventuallyAudited(async () => {
      let auditLogs = await listAll(auditOrg.clients.management, '/organization/audit-logs');
      let entry = auditLogs.find(
        item => item.resource == 'ai_gateway_config' && item.action == 'update'
      );
      expect(entry).toBeDefined();
      return entry!;
    });

    expect(entry).toMatchObject({ resource: 'ai_gateway_config', action: 'update' });
  }, 180_000);
});
