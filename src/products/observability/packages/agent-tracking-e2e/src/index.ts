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
  attributes?: Record<string, string>;
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

export let claudeCodeEventRecord = (d: {
  event: string;
  sessionId: string;
  email?: string;
  at: Date;
  attributes?: Record<string, string>;
}) => ({
  timeUnixNano: String(BigInt(d.at.getTime()) * 1_000_000n),
  body: { stringValue: `claude_code.${d.event}` },
  attributes: [
    text('event.name', d.event),
    text('session.id', d.sessionId),
    ...(d.email ? [text('user.email', d.email)] : []),
    ...Object.entries(d.attributes ?? {}).map(([key, value]) => text(key, value))
  ]
});

let apiRequestRecord = (request: ClaudeCodeRequest) => {
  let record = claudeCodeEventRecord({
    event: 'api_request',
    sessionId: request.sessionId,
    email: request.email,
    at: request.at,
    attributes: { request_id: uniqueId('req'), model: request.model, ...request.attributes }
  });

  return {
    ...record,
    attributes: [
      ...record.attributes,
      int('input_tokens', request.inputTokens),
      int('output_tokens', request.outputTokens),
      int('cache_read_tokens', request.cacheReadTokens),
      int('cache_creation_tokens', request.cacheCreationTokens),
      double('cost_usd', request.costUsd)
    ]
  };
};

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

export type DesktopContext = {
  remoteUrl: string;
  branch: string;
  ticketRefs: string[];
  pullRequest: { provider: string; repository: string; number: number };
};

// Desktop context is accepted only from a device-bound token.
export let sendDesktopContext = async (
  target: { ids: TrackedIds; ingestUrl: string },
  sessionId: string,
  context: DesktopContext
) => {
  let token = await agentTracking().ingestToken.create({
    organizationId: target.ids.organizationId,
    instanceId: (await trackedInstance(target.ids)).id,
    name: uniqueId('desktop'),
    userRef: uniqueId('user'),
    deviceRef: uniqueId('device')
  });

  let payloads: Record<string, unknown>[] = [
    {
      kind: 'session_context',
      remote_url: context.remoteUrl,
      branch: context.branch,
      default_branch: 'main',
      worktree: false,
      sub_path: 'services/api'
    },
    {
      kind: 'commit',
      sha: 'c'.repeat(40),
      ticket_refs: context.ticketRefs,
      ai_authored: true
    },
    {
      kind: 'pull_request',
      relation: 'opened',
      provider: context.pullRequest.provider,
      repository: context.pullRequest.repository,
      number: context.pullRequest.number
    },
    { kind: 'session_stats', lines_added: 12, lines_removed: 3 }
  ];

  let lines = [
    {
      batch_id: uniqueId('batch'),
      mode: 'live',
      sent_at: new Date().toISOString(),
      agent: { name: 'metorial-desktop', version: '1.0.0', install_id: uniqueId('install') }
    },
    ...payloads.map((payload, index) => ({
      client: 'claude-code',
      channel: 'envelope',
      dialect: 'metorial.desktop.context.v1',
      source: { kind: 'desktop', ref: `session:${sessionId}`, seq: index + 1 },
      observed_at: new Date().toISOString(),
      payload: { session_id: sessionId, ...payload }
    }))
  ];

  let response = await fetch(`${target.ingestUrl.replace(/\/+$/, '')}/v1/bulk`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-ndjson',
      authorization: `Bearer ${token.secret}`
    },
    body: lines.map(line => JSON.stringify(line)).join('\n') + '\n'
  });
  await expectIngested(response);

  return (await response.json()) as { accepted: number; rejected: number };
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
