import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import {
  apiKeyOf,
  catalogFingerprint,
  defaultCatalogPort,
  defaultScript,
  serveCatalog,
  startUpstream,
  type Upstream
} from '@mtsrc/ai-gateway-testing';
import { afterAll, beforeAll, beforeEach, expect } from 'vitest';
import { gateway, inferenceRest } from './client';

type CreateInstance = Parameters<typeof gateway.instance.upsert>[0];

export type Tenant = Awaited<ReturnType<typeof createTenant>>;

export let createTenant = async (
  instance: Partial<Pick<CreateInstance, 'settings' | 'limits' | 'logRetentionDays'>> = {}
) => {
  let organization = await gateway.organization.upsert({
    ref: uniqueId('org'),
    name: 'E2E organization'
  });
  let project = await gateway.project.upsert({
    organizationId: organization.id,
    ref: uniqueId('project'),
    name: 'E2E project'
  });
  let created = await gateway.instance.upsert({
    organizationId: organization.id,
    projectId: project.id,
    ref: uniqueId('instance'),
    name: 'E2E instance',
    ...instance
  });

  return {
    organization,
    project,
    instance: created,
    scope: { organizationId: organization.id, instanceId: created.id }
  };
};

export let useTenant = (instance: Parameters<typeof createTenant>[0] = {}) => {
  let tenant = {} as Tenant;
  beforeAll(async () => void Object.assign(tenant, await createTenant(instance)));
  return tenant;
};

type TokenInput = Partial<Parameters<typeof gateway.gatewayToken.create>[0]>;

export let createToken = (tenant: Tenant, input: TokenInput = {}) =>
  gateway.gatewayToken.create({
    ...tenant.scope,
    name: uniqueId('token'),
    ...input
  });

type ConnectionInput = Partial<Parameters<typeof gateway.providerConnection.create>[0]>;

export let createConnection = (tenant: Tenant, input: ConnectionInput = {}) =>
  gateway.providerConnection.create({
    ...tenant.scope,
    providerSlug: 'anthropic',
    name: uniqueId('connection'),
    credentials: { apiKey: uniqueId('key') },
    ...input
  });

export let useCatalog = () => {
  let catalog: Awaited<ReturnType<typeof serveCatalog>> | undefined;

  beforeAll(async () => {
    catalog = await serveCatalog(defaultCatalogPort);

    let isSynced = async () =>
      (await gateway.catalog.getSyncStatus({})).fingerprint === catalogFingerprint;

    if (!(await isSynced())) {
      await gateway.catalog.requestSync({});
      await eventually(async () => expect(await isSynced()).toBe(true), {
        timeoutMs: 90_000,
        intervalMs: 1_000
      });
    }
  });

  afterAll(async () => void (await catalog?.close()));
};

export let useUpstream = () => {
  let upstream = {} as Upstream;

  beforeAll(async () => void Object.assign(upstream, await startUpstream()));
  beforeEach(() => upstream.reset());
  afterAll(async () => void (await upstream.close()));

  return upstream;
};

export let apiKeys = {
  platformAnthropic: 'e2e-platform-anthropic-key',
  platformOpenai: 'e2e-platform-openai-key'
} as const;

export let keysOf = (upstream: Upstream) =>
  upstream.requests.map(request => apiKeyOf(request));

export let drain = async (stream: AsyncIterable<unknown>) => {
  let chunks: unknown[] = [];
  for await (let chunk of stream) chunks.push(chunk);
  return chunks;
};

export let chat = (
  secret: string,
  model: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {}
) =>
  inferenceRest(secret).post('/v1/chat/completions', {
    body: { model, messages: [{ role: 'user', content: 'Hi' }], ...extra },
    headers
  });

export let failing = (status: number, message = 'upstream failure') => ({
  steps: [],
  httpError: { status, body: { error: { message } } }
});

export let respondPerKey = (
  upstream: Upstream,
  responses: Record<string, Parameters<Upstream['respond']>[0]>
) =>
  upstream.respond(request => {
    let response = responses[apiKeyOf(request) ?? ''] ?? defaultScript;
    return typeof response == 'function' ? response(request) : response;
  });
