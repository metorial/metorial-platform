import { eventually } from '@metorial/e2e';
import { db } from '@mtsrc/ai-gateway-db';
import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { gateway } from '../support/client';
import { chat, createTenant, createToken, useCatalog, useUpstream } from '../support/fixtures';

let windowMs = 5 * 60_000;

describe('ai-gateway billing module', () => {
  useCatalog();
  useUpstream();

  let windowsOf = async (projectId: string, until: (count: number) => boolean) => {
    let rows: Awaited<ReturnType<typeof read>> = [];
    let read = () =>
      db.billingWindow.findMany({
        where: { project: { id: projectId } },
        orderBy: { windowStart: 'asc' }
      });

    await eventually(
      async () => {
        rows = await read();
        expect(until(rows.reduce((sum, row) => sum + row.requestCount, 0))).toBe(true);
      },
      { timeoutMs: 40_000, intervalMs: 1_000 }
    );

    return rows;
  };

  it('charges exact nano-dollars into five minute windows', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);

    await chat(token.secret, catalogModels.haiku);
    await chat(token.secret, catalogModels.haiku);
    let [row] = await windowsOf(tenant.project.id, count => count == 2);

    expect(row!.costNanoUsd).toBe(2n * 141_000n);
    expect(row!.status).toBe('open');
    expect(row!.windowStart.getTime() % windowMs).toBe(0);
    expect(row!.windowEnd.getTime() - row!.windowStart.getTime()).toBe(windowMs);
    expect(row!.revision).toBeGreaterThanOrEqual(1);
  });

  it('keeps projects apart', async () => {
    let [a, b] = await Promise.all([createTenant(), createTenant()]);
    let [tokenA, tokenB] = await Promise.all([createToken(a), createToken(b)]);

    await chat(tokenA.secret, catalogModels.haiku);
    await chat(tokenB.secret, catalogModels.haiku);
    await chat(tokenB.secret, catalogModels.haiku);

    let [rowA] = await windowsOf(a.project.id, count => count == 1);
    let [rowB] = await windowsOf(b.project.id, count => count == 2);
    expect(rowA!.costNanoUsd).toBe(141_000n);
    expect(rowB!.costNanoUsd).toBe(282_000n);
  });

  it('seals windows that ended and charges new usage to a fresh window', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);
    await chat(token.secret, catalogModels.haiku);
    let [row] = await windowsOf(tenant.project.id, count => count == 1);

    let start = new Date(Math.floor((Date.now() - 20 * 60_000) / windowMs) * windowMs);
    await db.billingWindow.update({
      where: { oid: row!.oid },
      data: { windowStart: start, windowEnd: new Date(start.getTime() + windowMs) }
    });

    await eventually(
      async () => {
        let sealed = await db.billingWindow.findUniqueOrThrow({ where: { oid: row!.oid } });
        expect(sealed.status).toBe('complete');
      },
      { timeoutMs: 100_000, intervalMs: 2_000 }
    );

    await chat(token.secret, catalogModels.haiku);
    let windows = await windowsOf(tenant.project.id, count => count == 2);

    expect(windows.map(window => window.status)).toEqual(['complete', 'open']);
    expect(windows.map(window => window.costNanoUsd)).toEqual([141_000n, 141_000n]);

    let listed = await gateway.billing.listWindows({
      from: new Date(Date.now() - 3_600_000),
      to: new Date(Date.now() + 3_600_000),
      statuses: ['complete'],
      limit: 500
    });
    expect(listed.items.some(window => window.projectId == tenant.project.id)).toBe(true);
  }, 180_000);
});
