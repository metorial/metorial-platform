import {
  e2eEndpoint,
  eventually,
  expectOk,
  listAll,
  uniqueId,
  type RestClient
} from '@metorial/e2e';
import { createAgentTrackingClient } from '@mtsrc/agent-tracking-client-internal';
import { expect } from 'vitest';

type TrackedIds = { organizationId: string; instanceId: string };

export type ClaudeCodeRequest = {
  sessionId: string;
  model: string;
  at: Date;
  email?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
};

type IngestTarget = { ingestUrl: string; secret: string };

export type CatalogModel = { id: string; name: string | null };

let minuteMs = 60 * 1000;

export let agentTracking = () =>
  createAgentTrackingClient({
    endpoint: `${e2eEndpoint('@mtsrc/agent-tracking-service', 'api')}/metorial-agent-tracking`
  });

export let agentTrackingPath = (
  instance: string | { ids: { instanceId: string } },
  path = ''
) =>
  `/dashboard/instances/${typeof instance == 'string' ? instance : instance.ids.instanceId}/agent-tracking${path}`;

export let agentTrackingSettingsPaths = (ids: {
  organizationId: string;
  projectId: string;
  instanceId: string;
}) => ({
  organization: `/dashboard/organizations/${ids.organizationId}/configure/agent-tracking`,
  project: `/dashboard/organizations/${ids.organizationId}/projects/${ids.projectId}/configure/agent-tracking`,
  instance: agentTrackingPath(ids.instanceId, '/settings')
});

export let claudeRequest = (
  overrides: Partial<ClaudeCodeRequest> = {}
): ClaudeCodeRequest => ({
  sessionId: uniqueId('session'),
  model: 'claude-sonnet-4-5-20250929',
  at: new Date(),
  inputTokens: 1000,
  outputTokens: 200,
  cacheReadTokens: 3000,
  cacheCreationTokens: 400,
  costUsd: 0.0125,
  ...overrides
});

let text = (key: string, value: string) => ({ key, value: { stringValue: value } });

let int = (key: string, value: number) => ({ key, value: { intValue: String(value) } });

let double = (key: string, value: number) => ({ key, value: { doubleValue: value } });

let apiRequestRecord = (request: ClaudeCodeRequest) => ({
  timeUnixNano: String(BigInt(request.at.getTime()) * 1_000_000n),
  body: { stringValue: 'claude_code.api_request' },
  attributes: [
    text('event.name', 'api_request'),
    text('session.id', request.sessionId),
    text('request_id', uniqueId('req')),
    text('model', request.model),
    ...(request.email ? [text('user.email', request.email)] : []),
    int('input_tokens', request.inputTokens),
    int('output_tokens', request.outputTokens),
    int('cache_read_tokens', request.cacheReadTokens),
    int('cache_creation_tokens', request.cacheCreationTokens),
    double('cost_usd', request.costUsd)
  ]
});

export let sendClaudeCodeLogs = (target: IngestTarget, records: unknown[]) =>
  fetch(`${target.ingestUrl.replace(/\/+$/, '')}/v1/logs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${target.secret}` },
    body: JSON.stringify({
      resourceLogs: [
        {
          resource: { attributes: [text('service.name', 'claude-code')] },
          scopeLogs: [
            { scope: { name: 'com.anthropic.claude_code.events' }, logRecords: records }
          ]
        }
      ]
    })
  });

export let sendClaudeCodeRequests = (target: IngestTarget, requests: ClaudeCodeRequest[]) =>
  sendClaudeCodeLogs(target, requests.map(apiRequestRecord));

export let expectIngested = async (response: Response) => {
  expect(response.status, await response.clone().text()).toBe(200);
};

export let trackedOrganization = (ids: Pick<TrackedIds, 'organizationId'>) =>
  agentTracking().organization.get({ organizationId: ids.organizationId });

export let trackedInstance = (ids: TrackedIds) =>
  agentTracking().instance.get({
    organizationId: ids.organizationId,
    instanceId: ids.instanceId
  });

export let trackedConsumer = (ids: Pick<TrackedIds, 'organizationId'>, consumerId: string) =>
  agentTracking().entity.getByRef({
    organizationId: ids.organizationId,
    kind: 'user',
    source: 'metorial.consumer',
    ref: consumerId
  });

export let trackedDevice = (ids: Pick<TrackedIds, 'organizationId'>, deviceId: string) =>
  agentTracking().entity.getByRef({
    organizationId: ids.organizationId,
    kind: 'device',
    source: 'metorial.device',
    ref: deviceId
  });

export let serviceSessions = async (ids: TrackedIds) =>
  (
    await agentTracking().session.list({
      organizationId: ids.organizationId,
      instanceIds: [(await trackedInstance(ids)).id],
      limit: 100
    })
  ).items;

let waitForSettledSessions = (ids: TrackedIds, count: number) =>
  eventually(
    async () => {
      let sessions = await serviceSessions(ids);
      expect(sessions).toHaveLength(count);
      for (let session of sessions) {
        expect(session.summary).not.toBeNull();
        expect(session.summaryStale).toBe(false);
      }

      return sessions;
    },
    { timeoutMs: 120_000, intervalMs: 1_000 }
  );

let serviceRequests = async (ids: TrackedIds, range: { from: Date; to: Date }) => {
  let result = await agentTracking().query.run({
    organizationId: ids.organizationId,
    scope: { instanceIds: [(await trackedInstance(ids)).id] },
    query: {
      atq: '0',
      dataset: 'usage',
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      measures: ['requests'],
      labels: false
    }
  });

  return (result.rows[0] as { requests?: number } | undefined)?.requests ?? 0;
};

export let ingestFirstUsage = async (
  org: { ids: TrackedIds; clients: { rest: RestClient } },
  requests: ClaudeCodeRequest[]
) => {
  let sourcesPath = agentTrackingPath(org.ids.instanceId, '/ingest-sources');
  let existing = [
    ...(await listAll(org.clients.rest, sourcesPath)),
    ...(await listAll(org.clients.rest, sourcesPath, { query: { status: 'revoked' } }))
  ];
  if (existing.length) {
    throw new Error('ingestFirstUsage needs an instance that never had an ingestion key.');
  }

  let source = expectOk(
    await org.clients.rest.post(sourcesPath, {
      name: uniqueId('Usage'),
      client_family: 'claude_code'
    })
  );

  await expectIngested(
    await sendClaudeCodeRequests(
      { ingestUrl: source.ingest_url, secret: source.secret },
      requests
    )
  );

  await waitForSettledSessions(
    org.ids,
    new Set(requests.map(request => request.sessionId)).size
  );

  let times = requests.map(request => request.at.getTime());
  let range = {
    from: new Date(Math.min(...times) - 60 * minuteMs),
    to: new Date(Math.max(...times) + minuteMs)
  };
  await eventually(
    async () => expect(await serviceRequests(org.ids, range)).toBe(requests.length),
    { timeoutMs: 60_000, intervalMs: 1_000 }
  );

  return source;
};

export let serviceCatalogModels = async (ids: TrackedIds) => {
  let models = new Map<string, CatalogModel | null>();

  for (let session of await serviceSessions(ids)) {
    for (let model of session.summary?.models ?? []) {
      for (let raw of model.rawIds) {
        if (!model.modelId) {
          models.set(raw, null);
          continue;
        }

        let known = await agentTracking()
          .knowledge.models.get({ modelId: model.modelId })
          .catch(() => null);
        models.set(raw, { id: model.modelId, name: known?.name ?? null });
      }
    }
  }

  return models;
};
