import { createHmac } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { computeOriginalWebhookRequestHash, type WebhookWireRequest } from '@slates/proto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ScopedInvocationGrantAuthority } from './invocation/types';
import {
  computeWebhookStateHash,
  createInMemoryWebhookAtomicCommitSeam,
  type ExactWebhookRuleBinding,
  type ExactWebhookTriggerProjection,
  executeExactWebhookPipeline
} from './webhookVerification';

let NOW_MS = Date.parse('2026-08-15T12:00:00.000Z');
let CONFIG_SCHEMA_HASH = 'c'.repeat(64);
let RECEIVER_ID = 'cursor-receiver';
let RECEIVER_TRIGGER_ID = 'cursor-receiver-trigger';
let CALLBACK_URL =
  'https://hooks.example.test/slates/triggers/cursor-receiver-trigger/path-secret';
let CALLBACK_SECRET = 'cursor-receiver-webhook-secret';
let CURSOR_API_TOKEN = 'cursor-api-plaintext-token';

type ToolOutcome =
  | 'success'
  | 'provider_failure'
  | 'timeout'
  | 'cancellation'
  | 'invalid_output';

type ExternalModules = {
  createProviderHandler: (...args: any[]) => { run(): Promise<any> };
  cursorProvider: any;
  axios: any;
  AxiosError: new (...args: any[]) => Error;
  AxiosHeaders: new (...args: any[]) => any;
};

let external: ExternalModules;
let originalAxiosAdapter: unknown;

let sourceImport = async (path: string) =>
  await import(/* @vite-ignore */ pathToFileURL(path).href);

beforeAll(async () => {
  let currentDirectory = dirname(fileURLToPath(import.meta.url));
  let metorialRoot = resolve(currentDirectory, '../../../../../../..');
  let integrationsRoot = resolve(metorialRoot, '..', 'integrations-enterprise');
  let [providerHandler, cursor, axios] = await Promise.all([
    sourceImport(
      resolve(integrationsRoot, 'integrations/packages/provider-handler/src/index.ts')
    ),
    sourceImport(resolve(integrationsRoot, 'integrations/integrations/cursor/src/index.ts')),
    sourceImport(resolve(integrationsRoot, 'integrations/node_modules/axios/index.js'))
  ]);
  external = {
    createProviderHandler: providerHandler.createProviderHandler,
    cursorProvider: cursor.provider,
    axios: axios.default,
    AxiosError: axios.AxiosError,
    AxiosHeaders: axios.AxiosHeaders
  };
  originalAxiosAdapter = external.axios.defaults.adapter;
});

afterAll(() => {
  if (external) external.axios.defaults.adapter = originalAxiosAdapter;
});

let handleProviderInput = async (manager: any, input: Record<string, unknown>) => {
  let managerClass = manager.constructor as {
    handleInput(manager: unknown, input: unknown): Promise<any>;
  };
  return await managerClass.handleInput(manager, input);
};

let jsonClone = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value));

let expectNoClassifiedLeak = (artifacts: unknown, forbidden: readonly string[]) => {
  let serialized = JSON.stringify(artifacts);
  for (let value of forbidden) {
    expect(serialized).not.toContain(value);
  }
};

let makeAgent = () => ({
  id: 'cursor-agent-1',
  name: 'Build Fixer',
  status: 'RUNNING',
  source: { repository: 'https://github.com/metorial/test-repository', ref: 'main' },
  target: { branchName: 'cursor/fix-build' },
  createdAt: '2026-08-15T12:00:00.000Z'
});

let createRuntime = async () => {
  let pendingBindings = new Map<string, any>();
  let grantAuthority = new ScopedInvocationGrantAuthority(
    {
      resolve: async request => {
        let bindings = pendingBindings.get(request.requestId);
        pendingBindings.delete(request.requestId);
        if (!bindings) throw new Error('The infrastructure-free authority binding is absent');
        return bindings;
      }
    },
    () => NOW_MS
  );
  let providerLogs: unknown[] = [];
  let outboundHttp: Array<{
    method: string;
    url: string;
    headers: Record<string, string>;
    body: Record<string, any>;
  }> = [];
  let persistence: unknown[] = [];
  let audit: unknown[] = [];
  let sentryReports: unknown[] = [];
  let providerReports: unknown[] = [];
  let clearCounts = new Map<string, number>();
  let revokeCounts = new Map<string, number>();
  let activeToolOutcome: ToolOutcome = 'success';
  let cancellationControllers = new Map<string, AbortController>();

  let captureProviderReports = async <Result>(handler: () => Promise<Result>) => {
    let original = console.error;
    console.error = (...args: unknown[]) => {
      providerReports.push(
        args.map(value =>
          value instanceof Error
            ? { name: value.name, message: value.message, stack: value.stack }
            : value
        )
      );
    };
    try {
      return await handler();
    } finally {
      console.error = original;
    }
  };

  let issue = async (request: any, bindings: any) => {
    pendingBindings.set(request.requestId, bindings);
    let resolution = await grantAuthority.resolve(request);
    try {
      return await grantAuthority.issue({
        request,
        authorityHandle: resolution.handle,
        ttlMs: 60_000
      });
    } finally {
      grantAuthority.release({ handle: resolution.handle, request });
    }
  };

  let redeem = async ({ envelope, expected }: any) => {
    let { secretNames: _secretNames, ...authorityExpected } = expected;
    let bindings = await grantAuthority.redeem({
      envelope,
      authenticated: true,
      expected: authorityExpected
    });
    let secrets =
      bindings.operation === 'tool_invoke'
        ? {
            'auth:$output': {
              value: JSON.stringify({ token: CURSOR_API_TOKEN }),
              version: 9
            },
            'receiver_callback:$url': { value: CALLBACK_URL, version: 5 },
            'receiver_callback:cursor_webhook_secret': {
              value: CALLBACK_SECRET,
              version: 21
            }
          }
        : bindings.operation === 'webhook_verify'
          ? { cursor_webhook_secret: { value: CALLBACK_SECRET, version: 21 } }
          : {};
    let cleared = false;
    return {
      bindings,
      secrets,
      clear: () => {
        if (cleared) return;
        cleared = true;
        clearCounts.set(envelope.grantId, (clearCounts.get(envelope.grantId) ?? 0) + 1);
        for (let secret of Object.values(secrets) as Array<{ value: string }>) {
          secret.value = '';
        }
      }
    };
  };

  let manager = await external
    .createProviderHandler(
      external.cursorProvider,
      [entries => providerLogs.push(...entries)],
      {
        now: () => NOW_MS,
        operationTimeoutMs: 25,
        getOperationSignal: ({ requestId }: { requestId: string }) =>
          cancellationControllers.get(requestId)?.signal,
        redeemScopedInvocationGrant: redeem
      }
    )
    .run();

  for (let message of [
    {
      jsonrpc: '2.0',
      method: 'slates/hello',
      params: { protocol: 'slates@2026-01-01' }
    },
    {
      jsonrpc: '2.0',
      method: 'slates/participant.set',
      params: { participants: [{ type: 'hub', id: 'hub', name: 'Hub' }] }
    },
    { jsonrpc: '2.0', method: 'slates/config.set', params: { config: {} } },
    {
      jsonrpc: '2.0',
      method: 'slates/auth.set',
      params: {
        authenticationMethodId: 'api_key',
        output: { $output: { configured: true } }
      }
    },
    {
      jsonrpc: '2.0',
      method: 'slates/session.start',
      params: { sessionId: 'cursor-production-path', state: {} }
    }
  ]) {
    let response = await handleProviderInput(manager, message);
    expect(response).toBeUndefined();
  }

  external.axios.defaults.adapter = async (config: any) => {
    let data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    outboundHttp.push({
      method: String(config.method ?? 'get').toUpperCase(),
      url: new URL(config.url, config.baseURL).toString(),
      headers: config.headers.toJSON(),
      body: data
    });
    if (activeToolOutcome === 'timeout' || activeToolOutcome === 'cancellation') {
      return await new Promise((_resolve, reject) => {
        let cancel = () =>
          reject(
            new external.AxiosError(
              'Cursor request cancelled by the scoped operation',
              'ERR_CANCELED',
              config
            )
          );
        if (config.signal?.aborted) cancel();
        else config.signal?.addEventListener('abort', cancel, { once: true });
      });
    }
    if (activeToolOutcome === 'provider_failure') {
      let response = {
        data: { error: 'Cursor rejected the launch request' },
        status: 503,
        statusText: 'Service Unavailable',
        headers: new external.AxiosHeaders({ 'content-type': 'application/json' }),
        config,
        request: {}
      };
      throw new external.AxiosError(
        'Cursor rejected the launch request',
        'ERR_BAD_RESPONSE',
        config,
        {},
        response
      );
    }
    return {
      data: activeToolOutcome === 'invalid_output' ? { ...makeAgent(), id: 123 } : makeAgent(),
      status: 200,
      statusText: 'OK',
      headers: new external.AxiosHeaders({ 'content-type': 'application/json' }),
      config,
      request: {}
    };
  };

  let listResponse = await handleProviderInput(manager, {
    jsonrpc: '2.0',
    id: 'cursor-actions-list',
    method: 'slates/actions.list',
    params: {}
  });
  let actions = listResponse.result.actions as any[];
  let callbackAction = actions.find(action => action.id === 'agent_status_change');
  expect(callbackAction).toMatchObject({
    id: 'agent_status_change',
    type: 'action.trigger',
    invocation: {
      type: 'webhook',
      http: { ingress: { verification: { mechanism: 'provider' } } }
    }
  });

  let revoke = async (envelope: any) => {
    await grantAuthority.revoke(envelope);
    revokeCounts.set(envelope.grantId, (revokeCounts.get(envelope.grantId) ?? 0) + 1);
  };

  let issueToolGrant = async (requestId: string) => {
    let request = {
      requestId,
      operation: 'tool_invoke' as const,
      deploymentId: 'cursor-deployment',
      runtimeIdentityId: 'cursor-runtime',
      runtimeIdentityGeneration: 3,
      slateInstanceId: 'cursor-instance',
      actionId: 'launch_agent',
      hubInvocationId: `hub-${requestId}`
    };
    let envelope = await issue(request, {
      deploymentId: request.deploymentId,
      runtimeIdentityId: request.runtimeIdentityId,
      runtimeIdentityGeneration: request.runtimeIdentityGeneration,
      tenantId: 'cursor-tenant',
      slateInstanceId: request.slateInstanceId,
      configSchemaVersion: 2,
      configSchemaHash: CONFIG_SCHEMA_HASH,
      hubInvocationId: request.hubInvocationId,
      requestId,
      actionId: request.actionId,
      operation: 'tool_invoke' as const,
      configSecretVersions: {},
      authConfigId: 'cursor-auth',
      authSecretVersions: { 'auth:$output': 9 },
      receiverCallback: {
        receiverId: RECEIVER_ID,
        receiverTriggerId: RECEIVER_TRIGGER_ID,
        triggerActionId: 'agent_status_change',
        specHash: callbackAction.specHash,
        registrationGeneration: 8,
        registrationVersion: 13,
        projectedSecretVersions: { cursor_webhook_secret: 21 }
      }
    });
    return { request, envelope };
  };

  let dispatchTool = async (outcome: ToolOutcome, requestId: string) => {
    activeToolOutcome = outcome;
    let issued = await issueToolGrant(requestId);
    if (outcome === 'cancellation') {
      let controller = new AbortController();
      cancellationControllers.set(requestId, controller);
      setTimeout(() => controller.abort(new Error('Hub cancelled the tool call')), 5);
    }
    let response = await captureProviderReports(
      async () =>
        await handleProviderInput(manager, {
          jsonrpc: '2.0',
          id: requestId,
          method: 'slates/action.tool.invoke',
          invocation: issued.envelope,
          params: {
            actionId: 'launch_agent',
            input: {
              promptText: 'Fix the build',
              sourceRepository: 'https://github.com/metorial/test-repository',
              sourceRef: 'main',
              autoCreatePr: true
            }
          }
        })
    );
    await revoke(issued.envelope);
    let safeResponse = jsonClone(response);
    persistence.push(
      'result' in safeResponse
        ? { requestId, status: 'succeeded', output: safeResponse.result.output }
        : { requestId, status: 'failed', error: safeResponse.error }
    );
    audit.push({
      requestId,
      outcome,
      httpRequestCount: outboundHttp.length,
      requestTraces: safeResponse.result?.requestTraces ?? []
    });
    if ('error' in safeResponse) {
      sentryReports.push({ requestId, error: safeResponse.error });
    }
    return { ...issued, response };
  };

  let issueWebhookGrant = async (d: {
    operation: 'webhook_verify' | 'webhook_handle';
    requestId: string;
    request: WebhookWireRequest;
    bindings?: ExactWebhookRuleBinding;
    trigger: ExactWebhookTriggerProjection;
  }) => {
    if (
      d.trigger.receiverId !== RECEIVER_ID ||
      d.trigger.receiverTriggerId !== RECEIVER_TRIGGER_ID ||
      d.trigger.registrationGeneration !== 8 ||
      d.trigger.registrationVersion !== 13 ||
      d.trigger.specHash !== callbackAction.specHash
    ) {
      throw new Error('Hub authoritative receiver binding is stale or contradictory');
    }
    let originalRequestHash = computeOriginalWebhookRequestHash(d.request);
    let request = {
      requestId: d.requestId,
      operation: d.operation,
      receiverTriggerId: RECEIVER_TRIGGER_ID,
      hubInvocationId: `hub-${d.operation}-${d.requestId}`
    };
    let exactBindings = d.bindings;
    let envelope = await issue(request, {
      tenantId: 'cursor-tenant',
      slateInstanceId: 'cursor-instance',
      configSchemaVersion: 2,
      configSchemaHash: CONFIG_SCHEMA_HASH,
      hubInvocationId: request.hubInvocationId,
      requestId: d.requestId,
      operation: d.operation,
      actionId: 'agent_status_change',
      specHash: callbackAction.specHash,
      ruleId: 'cursor.delivery.v1',
      originalRequestHash,
      dispatchRequestHash: exactBindings?.dispatchRequestHash ?? originalRequestHash,
      receiverId: RECEIVER_ID,
      receiverTriggerId: RECEIVER_TRIGGER_ID,
      registrationStatus: 'registered',
      registrationGeneration: 8,
      registrationVersion: 13,
      projectedSecretVersions:
        d.operation === 'webhook_verify' ? { cursor_webhook_secret: 21 } : {},
      candidateBindings: exactBindings?.selectedItems ?? []
    });
    return { envelope, originalRequestHash };
  };

  let providerDependencies = (atomicCommit: any) => ({
    verifyProvider: async ({ trigger, rule, request, requestId }: any) => {
      let issued = await issueWebhookGrant({
        operation: 'webhook_verify',
        requestId,
        request,
        trigger
      });
      try {
        let response = await handleProviderInput(manager, {
          jsonrpc: '2.0',
          id: requestId,
          method: 'slates/action.trigger.webhook_verify',
          invocation: issued.envelope,
          params: {
            actionId: trigger.actionId,
            specHash: trigger.specHash,
            ruleId: rule.id,
            requestId,
            originalRequest: request,
            originalRequestHash: issued.originalRequestHash
          }
        });
        if ('error' in response) throw new Error(response.error.message);
        return response.result;
      } finally {
        await revoke(issued.envelope);
      }
    },
    mapProvider: async ({ trigger, rule, request, bindings }: any) => {
      let issued = await issueWebhookGrant({
        operation: 'webhook_handle',
        requestId: bindings.requestId,
        request,
        bindings,
        trigger
      });
      try {
        let response = await handleProviderInput(manager, {
          jsonrpc: '2.0',
          id: bindings.requestId,
          method: 'slates/action.trigger.webhook_handle',
          invocation: issued.envelope,
          params: {
            actionId: trigger.actionId,
            request,
            specHash: trigger.specHash,
            ruleId: rule.id,
            triggerId: trigger.receiverTriggerId,
            originalRequestHash: bindings.originalRequestHash,
            dispatchRequestHash: bindings.dispatchRequestHash
          }
        });
        if ('error' in response) throw new Error(response.error.message);
        return { bindings, inputs: response.result.inputs };
      } finally {
        await revoke(issued.envelope);
      }
    },
    atomicCommit
  });

  return {
    manager,
    callbackAction,
    outboundHttp,
    providerLogs,
    persistence,
    audit,
    sentryReports,
    providerReports,
    clearCounts,
    revokeCounts,
    dispatchTool,
    captureProviderReports,
    providerDependencies
  };
};

let assertExactlyOnceCleanup = (runtime: Awaited<ReturnType<typeof createRuntime>>) => {
  expect([...runtime.clearCounts.values()].every(count => count === 1)).toBe(true);
  expect([...runtime.revokeCounts.values()].every(count => count === 1)).toBe(true);
  expect(runtime.clearCounts.size).toBe(runtime.revokeCounts.size);
};

describe('Cursor infrastructure-free production path', () => {
  it.each([
    'success',
    'provider_failure',
    'timeout',
    'cancellation',
    'invalid_output'
  ] as const)(
    'runs the real launch_agent path for %s without artifact leakage',
    async outcome => {
      let runtime = await createRuntime();
      let requestId = `cursor-tool-${outcome}`;
      let execution = await runtime.dispatchTool(outcome, requestId);

      expect(runtime.outboundHttp).toHaveLength(1);
      expect(runtime.outboundHttp[0]).toMatchObject({
        method: 'POST',
        url: 'https://api.cursor.com/v0/agents',
        body: {
          prompt: { text: 'Fix the build' },
          source: {
            repository: 'https://github.com/metorial/test-repository',
            ref: 'main'
          },
          webhook: { url: CALLBACK_URL, secret: CALLBACK_SECRET }
        }
      });
      expect(runtime.outboundHttp[0]!.headers.Authorization).toBe(
        `Basic ${Buffer.from(`${CURSOR_API_TOKEN}:`).toString('base64')}`
      );

      if (outcome === 'success') {
        expect(execution.response).toMatchObject({
          result: {
            output: {
              agentId: 'cursor-agent-1',
              agentName: 'Build Fixer',
              status: 'RUNNING'
            },
            requestTraces: [
              { request: { method: 'POST', url: 'https://api.cursor.com/v0/agents' } }
            ]
          }
        });
        expect(JSON.stringify(execution.response.result.requestTraces)).toContain(
          '[redacted]'
        );
      } else {
        expect(execution.response).toHaveProperty('error');
      }

      assertExactlyOnceCleanup(runtime);
      expectNoClassifiedLeak(
        {
          response: execution.response,
          persistence: runtime.persistence,
          audit: runtime.audit,
          providerLogs: runtime.providerLogs,
          sentryReports: runtime.sentryReports,
          providerReports: runtime.providerReports
        },
        [
          CALLBACK_URL,
          CALLBACK_SECRET,
          CURSOR_API_TOKEN,
          Buffer.from(`${CURSOR_API_TOKEN}:`).toString('base64'),
          execution.envelope.grantId,
          execution.envelope.token
        ]
      );
    }
  );

  it('rejects a replayed Hub tool grant before a second provider HTTP request', async () => {
    let runtime = await createRuntime();
    let execution = await runtime.dispatchTool('success', 'cursor-tool-replay');
    let replay = await runtime.captureProviderReports(
      async () =>
        await handleProviderInput(runtime.manager, {
          jsonrpc: '2.0',
          id: execution.request.requestId,
          method: 'slates/action.tool.invoke',
          invocation: execution.envelope,
          params: {
            actionId: 'launch_agent',
            input: { promptText: 'Fix the build' }
          }
        })
    );

    expect(replay).toHaveProperty('error');
    expect(runtime.outboundHttp).toHaveLength(1);
    assertExactlyOnceCleanup(runtime);
    expectNoClassifiedLeak({ replay, providerReports: runtime.providerReports }, [
      CALLBACK_URL,
      CALLBACK_SECRET,
      CURSOR_API_TOKEN,
      execution.envelope.grantId,
      execution.envelope.token
    ]);
  });

  it('runs the real signed verifier, request mapper and event mapper through Hub replay commit', async () => {
    let runtime = await createRuntime();
    let memory = createInMemoryWebhookAtomicCommitSeam();
    let callbackBody = JSON.stringify({
      event: 'statusChange',
      timestamp: '2026-08-15T12:00:00.000Z',
      id: 'cursor-agent-1',
      status: 'FINISHED',
      source: { repository: 'https://github.com/metorial/test-repository', ref: 'main' },
      target: {
        branchName: 'cursor/fix-build',
        url: 'https://cursor.com/agents/cursor-agent-1',
        prUrl: 'https://github.com/metorial/test-repository/pull/1'
      },
      summary: 'Build fixed'
    });
    let signature = `sha256=${createHmac('sha256', CALLBACK_SECRET)
      .update(callbackBody)
      .digest('hex')}`;
    let request: WebhookWireRequest = {
      url: CALLBACK_URL,
      method: 'POST',
      headers: [['x-webhook-signature', signature]],
      body: { present: true, base64: Buffer.from(callbackBody).toString('base64') }
    };
    let projection: ExactWebhookTriggerProjection = {
      receiverId: RECEIVER_ID,
      receiverTriggerId: RECEIVER_TRIGGER_ID,
      actionId: 'agent_status_change',
      specHash: runtime.callbackAction.specHash,
      registrationStatus: 'registered',
      registrationGeneration: 8,
      registrationVersion: 13,
      verification: runtime.callbackAction.invocation.http.ingress.verification,
      secrets: [
        {
          name: 'cursor_webhook_secret',
          value: CALLBACK_SECRET,
          encoding: 'utf8',
          version: 21,
          status: 'active'
        }
      ],
      actionInputSchema: runtime.callbackAction.inputSchema,
      state: {},
      stateVersion: 1,
      stateHash: computeWebhookStateHash({})
    };
    let dependencies = runtime.providerDependencies(memory.seam);
    let first = await executeExactWebhookPipeline({
      receiverId: RECEIVER_ID,
      requestId: 'cursor-callback-first',
      request,
      triggers: [projection],
      dependencies,
      nowMs: NOW_MS
    });
    let duplicate = await executeExactWebhookPipeline({
      receiverId: RECEIVER_ID,
      requestId: 'cursor-callback-duplicate',
      request,
      triggers: [projection],
      dependencies,
      nowMs: NOW_MS
    });

    expect(first).toMatchObject({ status: 'committed' });
    expect(duplicate).toMatchObject({ status: 'duplicate' });
    expect(memory.committed).toHaveLength(1);
    expect(memory.committed[0]!.dispatches[0]!.inputs[0]).toMatchObject({
      agentId: 'cursor-agent-1',
      status: 'FINISHED',
      summary: 'Build fixed'
    });

    await handleProviderInput(runtime.manager, {
      jsonrpc: '2.0',
      method: 'slates/auth.set',
      params: {
        authenticationMethodId: 'api_key',
        output: { token: 'event-mapper-auth-placeholder' }
      }
    });
    let mappedEvent = await handleProviderInput(runtime.manager, {
      jsonrpc: '2.0',
      id: 'cursor-map-event',
      method: 'slates/action.trigger.map_event',
      params: {
        actionId: 'agent_status_change',
        input: memory.committed[0]!.dispatches[0]!.inputs[0]
      }
    });
    expect(mappedEvent).toMatchObject({
      result: {
        type: 'agent.finished',
        id: 'cursor-agent-1-2026-08-15T12:00:00.000Z',
        output: { agentId: 'cursor-agent-1', status: 'FINISHED' }
      }
    });

    let wrongSignatureRequest = {
      ...request,
      headers: [['x-webhook-signature', 'sha256=invalid']]
    } as WebhookWireRequest;
    let wrongSignature = await executeExactWebhookPipeline({
      receiverId: RECEIVER_ID,
      requestId: 'cursor-callback-wrong-signature',
      request: wrongSignatureRequest,
      triggers: [projection],
      dependencies: runtime.providerDependencies(createInMemoryWebhookAtomicCommitSeam().seam),
      nowMs: NOW_MS
    });
    let wrongReceiver = await executeExactWebhookPipeline({
      receiverId: 'wrong-cursor-receiver',
      requestId: 'cursor-callback-wrong-receiver',
      request,
      triggers: [projection],
      dependencies: runtime.providerDependencies(createInMemoryWebhookAtomicCommitSeam().seam),
      nowMs: NOW_MS
    });
    let wrongGeneration = await executeExactWebhookPipeline({
      receiverId: RECEIVER_ID,
      requestId: 'cursor-callback-wrong-generation',
      request,
      triggers: [{ ...projection, registrationGeneration: 9 }],
      dependencies: runtime.providerDependencies(createInMemoryWebhookAtomicCommitSeam().seam),
      nowMs: NOW_MS
    });

    expect(wrongSignature).toMatchObject({ status: 'rejected', code: 'credential_invalid' });
    expect(wrongReceiver).toMatchObject({ status: 'rejected', code: 'no_matching_rule' });
    expect(wrongGeneration).toMatchObject({ status: 'rejected', code: 'provider_error' });
    assertExactlyOnceCleanup(runtime);
    expectNoClassifiedLeak(
      {
        first,
        duplicate,
        wrongSignature,
        wrongReceiver,
        wrongGeneration,
        mappedEvent,
        persistedDispatches: memory.committed.map(commit => ({
          requestId: commit.requestId,
          receiverId: commit.receiverId,
          originalRequestHash: commit.originalRequestHash,
          dispatches: commit.dispatches.map(dispatch => ({
            bindings: dispatch.bindings,
            inputs: dispatch.inputs,
            replayKeys: dispatch.replayKeys
          }))
        })),
        providerLogs: runtime.providerLogs,
        providerReports: runtime.providerReports
      },
      [CALLBACK_URL, CALLBACK_SECRET, CURSOR_API_TOKEN]
    );
  });
});
