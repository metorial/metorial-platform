import { eventually } from '@metorial/e2e';
import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { gateway } from '../support/client';
import {
  chat,
  createConnection,
  createTenant,
  createToken,
  useCatalog,
  useUpstream,
  type Tenant
} from '../support/fixtures';

describe('ai-gateway billing api', () => {
  useCatalog();
  useUpstream();

  let windowsOf = async (tenant: Tenant, until: (windows: any[]) => boolean) => {
    let windows: any[] = [];

    await eventually(
      async () => {
        let page = await gateway.billing.listWindows({
          from: new Date(Date.now() - 3_600_000),
          to: new Date(Date.now() + 3_600_000),
          limit: 500
        });
        windows = page.items.filter(window => window.projectId == tenant.project.id);
        expect(until(windows)).toBe(true);
      },
      { timeoutMs: 40_000, intervalMs: 1_000 }
    );

    return windows;
  };

  let sum = (windows: any[], key: 'costMicroUsd' | 'requestCount') =>
    windows.reduce((total, window) => total + window[key], 0);

  it('bills requests served by the Metorial provider', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);

    for (let request = 0; request < 3; request++)
      await chat(token.secret, catalogModels.haiku);
    let windows = await windowsOf(tenant, windows => sum(windows, 'requestCount') == 3);

    expect(windows[0]).toMatchObject({
      object: 'ai_gateway#billing_window',
      projectRef: tenant.project.ref,
      organizationRef: tenant.organization.ref
    });
    expect(sum(windows, 'costMicroUsd')).toBe(3 * 141);
    expect(
      new Date(windows[0].windowEnd).getTime() - new Date(windows[0].windowStart).getTime()
    ).toBe(5 * 60_000);
  });

  it('does not bill requests over customer connections', async () => {
    let billed = await createTenant();
    let free = await createTenant();
    await createConnection(free, { credentials: { apiKey: 'customer-key' } });
    let [billedToken, freeToken] = await Promise.all([createToken(billed), createToken(free)]);

    await chat(freeToken.secret, catalogModels.haiku);
    await chat(billedToken.secret, catalogModels.haiku);
    await windowsOf(billed, windows => windows.length > 0);

    let page = await gateway.billing.listWindows({
      from: new Date(Date.now() - 3_600_000),
      to: new Date(Date.now() + 3_600_000),
      limit: 500
    });
    expect(page.items.filter(window => window.projectId == free.project.id)).toEqual([]);
  });

  it('bills the price of the Metorial provider, not the connection override', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);

    await chat(token.secret, `metorial:${catalogModels.haiku}`);
    let windows = await windowsOf(tenant, windows => sum(windows, 'requestCount') == 1);

    expect(sum(windows, 'costMicroUsd')).toBe(141);
  });

  it('lists windows in pages', async () => {
    let tenants = await Promise.all([createTenant(), createTenant()]);
    for (let tenant of tenants) {
      await chat((await createToken(tenant)).secret, catalogModels.haiku);
    }
    for (let tenant of tenants) await windowsOf(tenant, windows => windows.length > 0);

    let page = await gateway.billing.listWindows({
      from: new Date(Date.now() - 3_600_000),
      to: new Date(Date.now() + 3_600_000),
      limit: 1
    });

    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(true);
  });

  it('filters windows by status and range', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);
    await chat(token.secret, catalogModels.haiku);
    await windowsOf(tenant, windows => windows.length > 0);

    let past = await gateway.billing.listWindows({
      from: new Date('2020-01-01T00:00:00Z'),
      to: new Date('2020-01-02T00:00:00Z')
    });
    expect(past.items).toEqual([]);

    let complete = await gateway.billing.listWindows({
      from: new Date(Date.now() - 3_600_000),
      to: new Date(Date.now() + 3_600_000),
      statuses: ['complete'],
      limit: 500
    });
    expect(complete.items.every(window => window.status == 'complete')).toBe(true);
  });

  it('applies and lifts billing restrictions on a project', async () => {
    let tenant = await createTenant();

    let restricted = await gateway.billing.setRestriction({
      projectId: tenant.project.id,
      restriction: { reason: 'Out of credits' }
    });
    expect(restricted).toMatchObject({
      object: 'ai_gateway#platform_limit_target',
      id: tenant.project.id,
      billingRestriction: { reason: 'Out of credits' }
    });

    let lifted = await gateway.billing.setRestriction({
      projectId: tenant.project.id,
      restriction: null
    });
    expect(lifted.billingRestriction).toBeNull();
  });
});
