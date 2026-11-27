import { parseRedisUrl } from '@lowerdeck/redis';
import {
  type BootstrappedOrganization,
  connectSession,
  createProviderSession,
  expectOk,
  type McpTestTool,
  uniqueId
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { Queue } from 'bullmq';
import { expect } from 'vitest';
import { env } from '../src/env';

export let scopeOf = async (org: BootstrappedOrganization) => {
  let fixture = await loadOrganizationFixture(org.ids);
  let scope = await resolveMetorialFacing({ instance: fixture.instance });

  return { fixture, instance: fixture.instance, ...scope };
};

export let textTool = (name: string): McpTestTool => ({
  name,
  description: `Returns ${name}`,
  inputSchema: { type: 'object', properties: {} },
  handler: () => name
});

export let setTools = (tools: McpTestTool[], next: McpTestTool[]) => {
  tools.splice(0, tools.length, ...next);
};

export let toolKeys = (spec: { value: { tools: { key: string }[] } } | null | undefined) =>
  (spec?.value.tools ?? []).map(tool => tool.key).sort();

/** A client `tools/list` on a fresh session runs connection-scoped discovery for the provider. */
export let listSessionTools = async (org: BootstrappedOrganization, providerId: string) => {
  let session = await createProviderSession(org.clients.instance, [providerId]);
  let client = connectSession(session.id, org.keys.instanceSecret);

  let init = await client.initialize();
  expect(init.status).toBe(200);

  let listed = await client.listTools();
  expect(listed.error).toBeUndefined();

  let tools = listed.result.tools as { name: string; title?: string }[];
  return { session, client, tools, names: tools.map(tool => tool.name) };
};

export let loadProvider = (providerId: string) =>
  subspaceDb.provider.findUniqueOrThrow({
    where: { id: providerId },
    include: {
      publisher: true,
      entry: true,
      type: true,
      defaultVariant: { include: { shuttleServer: true, backend: true } }
    }
  });

export let loadCurrentVersion = async (providerId: string) => {
  let provider = await loadProvider(providerId);

  return await subspaceDb.providerVersion.findUniqueOrThrow({
    where: { oid: provider.defaultVariant!.currentVersionOid! },
    include: { specification: true, shuttleServerVersion: true }
  });
};

export let createProviderDeployment = async (
  org: BootstrappedOrganization,
  providerId: string
) => {
  let deployment = expectOk(
    await org.clients.instance.post('/provider-deployments', {
      provider_id: providerId,
      name: uniqueId('deployment')
    })
  );

  return deployment.id as string;
};

/** Runs a `@lowerdeck/cron` handler now by queueing a job on the cron's BullMQ queue. */
export let triggerCron = async (name: string) => {
  let queue = new Queue(`Cr0N_${name}`, { connection: parseRedisUrl(env.service.REDIS_URL) });

  try {
    await queue.add('e2e', {});
  } finally {
    await queue.close();
  }
};
