import { createPrismaPgAdapter } from '@lowerdeck/prisma-pg';
import { readReplicas } from '@prisma/extension-read-replicas';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFakePg,
  dnsError
} from '../../../../lowerdeck/packages/prisma-pg/test/fakeClient';
import { PrismaClient } from '../prisma/generated/client';

let clients: PrismaClient[] = [];

let createClient = (role: 'primary' | 'replica' = 'primary') => {
  let driver = createFakePg();
  let client = new PrismaClient({
    adapter: createPrismaPgAdapter(
      { Client: driver.Client, idleTimeoutMillis: 0 },
      {
        environment: 'development',
        databaseName: 'test',
        role
      }
    )
  });

  clients.push(client);
  return { client, state: driver.state };
};

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(async () => {
  await Promise.all(clients.map(client => client.$disconnect()));
  clients = [];
  vi.restoreAllMocks();
});

describe('Prisma connection retries', () => {
  it('lets an HTTP request succeed after a temporary DNS failure', async () => {
    let { client, state } = createClient();
    state.connectErrors = [dnsError()];
    let app = new Hono();

    app.get('/', async c =>
      c.json(
        await client.slateWebhookEvent.findUnique({
          where: { id: 'synthetic-test' },
          select: { id: true }
        })
      )
    );

    let response = await app.request('/');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'synthetic-test' });
    expect(state.connectCount).toBe(2);
    expect(state.queries).toHaveLength(1);
  });

  it('executes a write once after two acquisition failures', async () => {
    let { client, state } = createClient();
    state.connectErrors = [dnsError(), dnsError()];

    await expect(
      client.$executeRawUnsafe('UPDATE counter SET value = value + 1')
    ).resolves.toBe(1);

    expect(state.connectCount).toBe(3);
    expect(state.queries).toEqual(['UPDATE counter SET value = value + 1']);
  });

  it('does not replay a write after SQL has been dispatched', async () => {
    let { client, state } = createClient();
    state.queryError = dnsError();

    await expect(
      client.$executeRawUnsafe('UPDATE counter SET value = value + 1')
    ).rejects.toBeDefined();

    expect(state.connectCount).toBe(1);
    expect(state.queries).toHaveLength(1);
  });

  // These tests exercise Prisma's transaction boundary; application code uses withTransaction.
  it('retries acquisition before BEGIN without replaying the transaction callback', async () => {
    let { client, state } = createClient();
    state.connectErrors = [dnsError()];
    let callback = vi.fn(
      async tx => await tx.$executeRawUnsafe('UPDATE counter SET value = value + 1')
    );

    await client.$transaction(callback);

    expect(state.connectCount).toBe(2);
    expect(callback).toHaveBeenCalledOnce();
    expect(state.queries).toEqual(['BEGIN', 'UPDATE counter SET value = value + 1', 'COMMIT']);
  });

  it.each(['UPDATE', 'COMMIT'])(
    'does not restart a transaction after %s fails',
    async failQuery => {
      let { client, state } = createClient();
      state.queryError = dnsError();
      state.failQuery = failQuery;
      let callback = vi.fn(
        async tx => await tx.$executeRawUnsafe('UPDATE counter SET value = value + 1')
      );

      await expect(client.$transaction(callback)).rejects.toBeDefined();

      expect(callback).toHaveBeenCalledOnce();
      expect(state.connectCount).toBe(1);
      expect(state.queries.filter(query => query === 'BEGIN')).toHaveLength(1);
      expect(state.queries.filter(query => query.startsWith('UPDATE'))).toHaveLength(1);
    }
  );

  it('retries the reader pool without changing replica routing', async () => {
    let primary = createClient();
    let replica = createClient('replica');
    replica.state.connectErrors = [dnsError()];
    let routed = primary.client.$extends(readReplicas({ replicas: [replica.client] }));

    let result = await routed.slateWebhookEvent.findUnique({
      where: { id: 'synthetic-test' },
      select: { id: true }
    });

    expect(result).toEqual({ id: 'synthetic-test' });
    expect(primary.state.connectCount).toBe(0);
    expect(replica.state.connectCount).toBe(2);
  });
});
