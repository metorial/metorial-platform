import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  putObject: vi.fn(),
  invocationUpdate: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn() })
}));

vi.mock('../../db', () => ({
  db: { slateInvocation: { update: mocks.invocationUpdate } }
}));

vi.mock('../../storage', () => ({
  storage: { putObject: mocks.putObject },
  invocationsBucketRecord: { bucket: 'invocations', oid: 1 }
}));

import { storeSlateInvocation } from './store';

let record = { oid: 10n, id: 'shiv_10' } as any;
let slateVersion = { oid: 1n, id: 'shvr_1' } as any;

let requestMessages = [
  {
    jsonrpc: '2.0' as const,
    id: 'req1',
    method: 'slates/action.tool.invoke' as const,
    params: { actionId: 'me', input: { secret: 'user-input' } }
  }
] as any;

let responseMessages = [
  {
    jsonrpc: '2.0' as const,
    id: 'req1',
    result: {
      output: { email: 'mock.user@example.com' },
      requestTraces: [
        { startedAt: 'now', durationMs: 1, request: { method: 'GET', url: 'https://x/y' } }
      ]
    }
  }
] as any;

let invocationResult = {
  id: 'fbiv_1',
  type: 'success',
  status: 'succeeded' as const,
  functionVersionId: 'fbvr_1',
  billedTimeMs: 12,
  computeTimeMs: 10,
  logs: [{ timestamp: 1, message: 'INFO Completed tool "Me" (me)' }],
  result: {}
} as any;

// Wait for the internal p-queue to drain the async store job.
let flush = () => new Promise(resolve => setTimeout(resolve, 20));

let storedPayload = () => JSON.parse(mocks.putObject.mock.calls[0]![2] as string);

describe('storeSlateInvocation retention gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.putObject.mockResolvedValue(undefined);
    mocks.invocationUpdate.mockResolvedValue(undefined);
  });

  it('stores the full payload for tenants that retain content', async () => {
    storeSlateInvocation({
      tenant: { storeContent: true } as any,
      slateVersion,
      participants: [],
      record,
      requestMessages,
      responseMessages,
      invocationResult
    });
    await flush();

    let payload = storedPayload();
    expect(payload.requests).toHaveLength(1);
    expect(payload.responses).toHaveLength(1);
    expect(payload.logs).toHaveLength(1);
    expect(payload.requestTraces).toHaveLength(1);
  });

  it('persists no request, response, log or trace content when the tenant disables it', async () => {
    storeSlateInvocation({
      tenant: { storeContent: false } as any,
      slateVersion,
      participants: [],
      record,
      requestMessages,
      responseMessages,
      invocationResult
    });
    await flush();

    let payload = storedPayload();
    expect(payload.requests).toEqual([]);
    expect(payload.responses).toEqual([]);
    expect(payload.logs).toEqual([]);
    expect(payload.requestTraces).toEqual([]);

    // Nothing user-derived may survive anywhere in the serialized blob.
    let serialized = mocks.putObject.mock.calls[0]![2] as string;
    expect(serialized).not.toContain('mock.user@example.com');
    expect(serialized).not.toContain('user-input');
    expect(serialized).not.toContain('Completed tool');

    // Operational metadata is still recorded so the invocation stays auditable.
    expect(payload.provider).toMatchObject({ status: 'succeeded', billedTimeMs: 12 });
    expect(mocks.invocationUpdate).toHaveBeenCalled();
  });

  it('drops the provider error payload when content is not retained', async () => {
    storeSlateInvocation({
      tenant: { storeContent: false } as any,
      slateVersion,
      participants: [],
      record,
      requestMessages,
      responseMessages,
      invocationResult: {
        ...invocationResult,
        type: 'error',
        status: 'failed',
        error: { message: 'boom mock.user@example.com' }
      }
    });
    await flush();

    let payload = storedPayload();
    expect(payload.provider.error).toBeNull();
    expect(mocks.putObject.mock.calls[0]![2]).not.toContain('mock.user@example.com');
  });

  it('retains content when no tenant is attached (platform-level invocations)', async () => {
    storeSlateInvocation({
      slateVersion,
      participants: [],
      record,
      requestMessages,
      responseMessages,
      invocationResult
    });
    await flush();

    expect(storedPayload().requests).toHaveLength(1);
  });
});

describe('storeSlateInvocation webhook content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.putObject.mockResolvedValue(undefined);
    mocks.invocationUpdate.mockResolvedValue(undefined);
  });

  it('keeps registration secrets, receive keys and credentials out of stored webhook invocations', async () => {
    storeSlateInvocation({
      tenant: { storeContent: true } as any,
      slateVersion,
      participants: [],
      record,
      requestMessages: [
        {
          jsonrpc: '2.0',
          id: 'process',
          method: 'slates/trigger_group.webhook.process',
          params: {
            triggerGroupId: 'events',
            url: 'https://hooks.example.com/receive/whk_global_urlkey?x=1',
            method: 'POST',
            headers: {
              Authorization: 'Bearer shared-delivery-token',
              'x-provider-signature': 'v0=abc',
              'content-type': 'application/json'
            },
            body: { encoding: 'base64', content: 'eyJ0eXBlIjoiZXZlbnQifQ==' },
            webhookRegistrationPayload: { signingSecret: 'registration-signing-secret' }
          }
        },
        {
          jsonrpc: '2.0',
          id: 'register',
          method: 'slates/trigger_group.webhook.register',
          params: {
            triggerGroupId: 'events',
            webhookUrl: 'https://hooks.example.com/receive/whk_tenant_urlkey',
            deliveryConfig: { bearerToken: 'delivery-config-token' }
          }
        }
      ] as any,
      responseMessages: [
        {
          jsonrpc: '2.0',
          id: 'process',
          result: { events: [{ payload: { type: 'event' } }] }
        },
        {
          jsonrpc: '2.0',
          id: 'register',
          result: {
            webhookRegistrationIdentifier: 'reg_1',
            webhookRegistrationPayload: { signingSecret: 'fresh-signing-secret' }
          }
        }
      ] as any,
      invocationResult
    });
    await flush();

    let serialized = mocks.putObject.mock.calls[0]![2] as string;
    for (let secret of [
      'registration-signing-secret',
      'fresh-signing-secret',
      'shared-delivery-token',
      'delivery-config-token',
      'whk_global_urlkey',
      'whk_tenant_urlkey'
    ]) {
      expect(serialized).not.toContain(secret);
    }

    let payload = storedPayload();
    expect(payload.requests[0].params).toMatchObject({
      triggerGroupId: 'events',
      url: 'https://hooks.example.com/receive/[REDACTED]?x=1',
      method: 'POST',
      headers: {
        Authorization: '[REDACTED]',
        'x-provider-signature': 'v0=abc',
        'content-type': 'application/json'
      },
      body: { encoding: 'base64', content: 'eyJ0eXBlIjoiZXZlbnQifQ==' },
      webhookRegistrationPayload: '[REDACTED]'
    });
    expect(payload.responses[0].result).toEqual({ events: [{ payload: { type: 'event' } }] });
    expect(payload.responses[1].result).toEqual({
      webhookRegistrationIdentifier: 'reg_1',
      webhookRegistrationPayload: '[REDACTED]'
    });
  });

  it('leaves non-webhook invocations untouched', async () => {
    storeSlateInvocation({
      tenant: { storeContent: true } as any,
      slateVersion,
      participants: [],
      record,
      requestMessages: [
        {
          jsonrpc: '2.0',
          id: 'tool',
          method: 'slates/action.tool.invoke',
          params: { actionId: 'fetch', input: { url: 'https://example.com/receive/abc' } }
        }
      ] as any,
      responseMessages: [
        { jsonrpc: '2.0', id: 'tool', result: { output: { ok: true } } }
      ] as any,
      invocationResult
    });
    await flush();

    expect(storedPayload().requests[0].params).toEqual({
      actionId: 'fetch',
      input: { url: 'https://example.com/receive/abc' }
    });
  });
});
