import { parseRedisUrl } from '@lowerdeck/redis';
import {
  type BootstrappedOrganization,
  connectSession,
  createProviderSession,
  uniqueId
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import type { SessionConnectionTransport } from '@metorial-subspace/db';
import { sessionService } from '@metorial-subspace/module-session';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { Queue } from 'bullmq';
import { expect } from 'vitest';
import { SenderManager } from '../src';
import { env } from '../src/env';

export let scopeOf = async (org: BootstrappedOrganization) => {
  let fixture = await loadOrganizationFixture(org.ids);
  let scope = await resolveMetorialFacing({ instance: fixture.instance });

  return { fixture, ...scope };
};

export let createEmptySession = async (org: BootstrappedOrganization) => {
  let { fixture } = await scopeOf(org);

  return await sessionService.createSession({
    instance: fixture.instance,
    organizationActor: fixture.actor,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('connection-session'), providers: [] }
  });
};

export let createManager = async (
  org: BootstrappedOrganization,
  d: { sessionId: string; connectionToken?: string; transport?: SessionConnectionTransport }
) => {
  let { tenant, solution } = await scopeOf(org);

  return await SenderManager.create({
    sessionId: d.sessionId,
    connectionToken: d.connectionToken,
    tenantId: tenant.id,
    solutionId: solution.id,
    transport: d.transport ?? 'tool_call'
  });
};

export let openConnection = async (org: BootstrappedOrganization, sessionId: string) => {
  let manager = await createManager(org, { sessionId });
  let connection = await manager.initialize({
    client: { identifier: uniqueId('e2e-client'), name: 'E2E client' },
    mcpTransport: 'none'
  });

  return { manager, connection };
};

export let openMcpSession = async (org: BootstrappedOrganization, providerId: string) => {
  let session = await createProviderSession(org.clients.instance, [providerId]);
  let client = connectSession(session.id, org.keys.instanceSecret);

  let init = await client.initialize();
  expect(init.status).toBe(200);

  let listed = await client.listTools();
  let tools = listed.result.tools as { name: string; title?: string }[];

  return { session, client, tools };
};

export let connectionEventTypes = async (connectionOid: bigint) =>
  (
    await subspaceDb.sessionEvent.findMany({
      where: { connectionOid },
      orderBy: { oid: 'asc' }
    })
  ).map(event => event.type);

/** Runs a `@lowerdeck/cron` handler now by queueing a job on the cron's BullMQ queue. */
export let triggerCron = async (name: string) => {
  let queue = new Queue(`Cr0N_${name}`, { connection: parseRedisUrl(env.service.REDIS_URL) });

  try {
    await queue.add('e2e', {});
  } finally {
    await queue.close();
  }
};
