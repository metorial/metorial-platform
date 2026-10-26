import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-usage', () => ({
  recordConnectionCreatedUsage: vi.fn(async () => {}),
  recordConnectionTimeUsage: vi.fn(async () => {}),
  recordSessionErrorUsage: vi.fn(async () => {}),
  recordSessionMessageUsage: vi.fn(async () => {})
}));

vi.mock('@lowerdeck/error', () => ({
  ServiceError: class ServiceError extends Error {},
  badRequestError: ({ message }: { message: string }) => new Error(message),
  goneError: ({ message }: { message: string }) => new Error(message),
  internalServerError: ({ message }: { message: string }) => new Error(message),
  notFoundError: (_object: string, id?: string) => new Error(id ?? 'not found'),
  preconditionFailedError: ({ message }: { message: string }) => new Error(message)
}));
vi.mock('@lowerdeck/lock', () => ({ createLock: vi.fn(() => ({})) }));
let sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: vi.fn(() => sentry)
}));
vi.mock('@metorial-subspace/conduit', () => ({
  ConduitSendError: class ConduitSendError extends Error {}
}));
vi.mock('@metorial-subspace/db', () => ({
  db: {},
  getId: vi.fn(),
  ID: {},
  withTransaction: vi.fn()
}));
vi.mock('@metorial-subspace/module-agent', () => ({}));
vi.mock('@metorial-subspace/module-callback', () => ({ callbackEventService: {} }));
vi.mock('@metorial-subspace/module-enclave', () => ({}));
vi.mock('@metorial-subspace/module-provider-internal', () => ({}));
vi.mock('@metorial-subspace/module-session', () => ({
  applySessionProviderNameTemplate: vi.fn((template: string, name: string) =>
    template.replace('$', name)
  ),
  parseNameFromSessionProviderTemplates: vi.fn(() => null),
  sessionProviderNameTemplateService: {}
}));
vi.mock('@metorial-subspace/module-session/src/services/ephemeralManagedSession', () => ({
  ephemeralManagedSessionService: {}
}));
vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost' } }
}));
vi.mock('../lib/conduit', () => ({
  conduit: { createSender: vi.fn(() => ({})) }
}));
vi.mock('../lib/nats', () => ({ broadcastNats: { publish: vi.fn() } }));
vi.mock('../audit/recordMessage', () => ({ recordConnectionAuditEvent: vi.fn() }));
vi.mock('../shared/completeMessage', () => ({ completeMessage: vi.fn() }));
vi.mock('../shared/createError', () => ({ createError: vi.fn() }));
vi.mock('../shared/createMessage', () => ({ createMessage: vi.fn() }));
vi.mock('../shared/createWarning', () => ({ createWarning: vi.fn() }));
vi.mock('../shared/upsertParticipant', () => ({ upsertParticipant: vi.fn() }));
vi.mock('./connectionSpecification', () => ({
  isConnectionScopedProviderVersion: vi.fn(),
  resolveConnectionScopedSpecification: vi.fn()
}));
vi.mock('./toolSpecification', () => ({
  resolveProviderToolListingSpecificationOid: vi.fn()
}));

let syntheticTools = vi.hoisted(() => ({
  buildConnectionStatusReport: vi.fn(),
  resolveCallbackEventToolScope: vi.fn(),
  runCallbackEventTool: vi.fn()
}));

vi.mock('../lib/connectionStatusTool', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/connectionStatusTool')>()),
  buildConnectionStatusReport: syntheticTools.buildConnectionStatusReport
}));
vi.mock('../lib/callbackEventTools', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/callbackEventTools')>()),
  resolveCallbackEventToolScope: syntheticTools.resolveCallbackEventToolScope,
  runCallbackEventTool: syntheticTools.runCallbackEventTool
}));

import { ServiceError } from '@lowerdeck/error';
import { serialize } from '@lowerdeck/serialize';
import { parseNameFromSessionProviderTemplates } from '@metorial-subspace/module-session';
import { broadcastNats } from '../lib/nats';
import type { RequestScopedTool, RequestScopedTools } from '../lib/requestTools';
import { createMessage } from '../shared/createMessage';
import { SenderManager } from './manager';

let createManager = (
  isInternal: boolean,
  requestTools?: () => Promise<RequestScopedTools | null>
) => {
  let manager = new (SenderManager as any)(
    { id: 'ses_1', oid: 1n, isInternal },
    undefined,
    {},
    {},
    'tool_call',
    undefined,
    undefined,
    requestTools
  );
  manager.listProviders = vi.fn(async () => []);

  return manager as SenderManager;
};

let skillReadTool: RequestScopedTool = {
  key: 'metorial_skill_read',
  name: 'Read skill',
  description: 'Reads a skill',
  inputJsonSchema: { type: 'object', properties: { name: { type: 'string' } } },
  readOnly: true
};

let createRequestTools = (
  call: RequestScopedTools['call'] = vi.fn(async () => ({})),
  extra: Partial<RequestScopedTools> = {}
): RequestScopedTools => ({
  tools: [skillReadTool],
  call,
  ...extra
});

let resolveTo = (requestTools: RequestScopedTools | null) => vi.fn(async () => requestTools);

describe('SenderManager tool resolution', () => {
  it('resolves canonical adapter keys for internal sessions', async () => {
    let manager = createManager(true) as any;
    let provider = { id: 'spr_1', nameTemplate: 'slack_$' };
    let resolved = { provider, tool: { key: 'metorial_chat$workspace.list' } };

    manager.listProviders = vi.fn(async () => [provider]);
    manager.getLegacyToolMatch = vi.fn();
    manager.getProviderToolByResolvedName = vi.fn(async () => resolved);

    await expect(
      manager.getToolById({ toolId: 'metorial_chat$workspace.list' })
    ).resolves.toBe(resolved);
    expect(manager.getProviderToolByResolvedName).toHaveBeenCalledWith({
      provider,
      originalToolName: 'metorial_chat$workspace.list',
      finalToolName: 'metorial_chat$workspace.list'
    });
    expect(manager.getLegacyToolMatch).not.toHaveBeenCalled();
  });

  it('does not resolve canonical adapter keys for ordinary sessions', async () => {
    let manager = createManager(false) as any;
    let provider = { id: 'spr_1', nameTemplate: 'slack_$' };

    manager.listProviders = vi.fn(async () => [provider]);
    manager.getLegacyToolMatch = vi.fn(() => null);
    manager.getProviderToolByResolvedName = vi.fn();

    await expect(
      manager.getToolById({ toolId: 'metorial_chat$workspace.list' })
    ).rejects.toThrow('Invalid tool ID format');
    expect(manager.getLegacyToolMatch).toHaveBeenCalled();
    expect(manager.getProviderToolByResolvedName).not.toHaveBeenCalled();
  });
});

describe('SenderManager request-scoped tools', () => {
  let listTools = async (manager: any) =>
    (await manager.listToolsIncludingInternalAndNonAllowed()).tools;

  let listToolKeys = async (manager: any) =>
    (await listTools(manager)).map((tool: { key: string }) => tool.key);

  let callSyntheticTool = (manager: any, toolId: string, args: Record<string, any>) => {
    manager.connection = { initState: 'completed', oid: 2n };
    manager.ensureConnectionParticipant = vi.fn(async () => ({ id: 'spa_1' }));

    return manager.callTool({
      toolId,
      input: {
        type: 'mcp',
        data: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: toolId, arguments: args }
        }
      },
      waitForResponse: true,
      transport: 'mcp',
      clientMcpId: 1
    });
  };

  let callRequestTool = (manager: any) =>
    callSyntheticTool(manager, 'metorial_skill_read', { name: 'deploy' });

  let lastTargetedPublish = () => {
    let [, payload] = vi.mocked(broadcastNats.publish).mock.calls.at(-1)!;
    return serialize.decode(payload as string);
  };

  let lastCreatedMessage = () => vi.mocked(createMessage).mock.calls.at(-1)![0];

  let providerWithTool = (manager: any, key: string) => {
    let provider = { id: 'spr_1', fromTemplateProviderOid: null, nameTemplate: null };
    manager.listProviders = vi.fn(async () => [provider]);
    manager.listToolsForProvider = vi.fn(async () => ({
      status: 'ok',
      tools: [{ id: 'spr_1:tool', key, sessionProvider: provider }]
    }));
  };

  beforeEach(() => {
    vi.mocked(createMessage).mockReset();
    vi.mocked(createMessage).mockImplementation(async (d: any) => ({
      id: 'smsg_1',
      status: d.status,
      input: d.input,
      output: d.output,
      completedAt: null
    }));
    vi.mocked(broadcastNats.publish).mockReset();
    sentry.captureException.mockReset();
    sentry.captureMessage.mockReset();
    syntheticTools.buildConnectionStatusReport.mockReset();
    syntheticTools.resolveCallbackEventToolScope.mockReset();
    syntheticTools.runCallbackEventTool.mockReset();
  });

  it('lists request tools when they are provided', async () => {
    let manager = createManager(false, resolveTo(createRequestTools())) as any;
    manager.listProviders = vi.fn(async () => []);

    let requestTool = (await listTools(manager)).find(
      (tool: any) => tool.key === 'metorial_skill_read'
    );

    expect(requestTool).toMatchObject({
      id: 'ses_1:request_metorial_skill_read',
      name: 'Read skill',
      __metorialSynthetic: true,
      value: {
        tags: { readOnly: true, destructive: false },
        mcpToolType: { annotations: { readOnlyHint: true, destructiveHint: false } }
      }
    });
  });

  it('defaults request tools that are not read-only to destructive', async () => {
    let manager = createManager(
      false,
      resolveTo({ tools: [{ ...skillReadTool, readOnly: undefined }], call: vi.fn() })
    ) as any;
    manager.listProviders = vi.fn(async () => []);

    let requestTool = (await listTools(manager)).find(
      (tool: any) => tool.key === 'metorial_skill_read'
    );

    expect(requestTool.value).toMatchObject({
      tags: { readOnly: false, destructive: true },
      mcpToolType: { annotations: { readOnlyHint: false, destructiveHint: true } }
    });
  });

  it('does not list request tools when none are provided', async () => {
    let manager = createManager(false) as any;
    manager.listProviders = vi.fn(async () => []);

    expect(await listToolKeys(manager)).not.toContain('metorial_skill_read');
  });

  it('resolves request tools lazily and only once per manager', async () => {
    let resolver = resolveTo(createRequestTools());
    let manager = createManager(false, resolver) as any;
    manager.listProviders = vi.fn(async () => []);

    expect(resolver).not.toHaveBeenCalled();

    await listToolKeys(manager);
    await listToolKeys(manager);
    await manager.getToolById({ toolId: 'metorial_skill_read' });

    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('keeps listing provider tools when resolving request tools fails', async () => {
    let error = new Error('skills unavailable');
    let manager = createManager(
      false,
      vi.fn(async () => {
        throw error;
      })
    ) as any;
    providerWithTool(manager, 'slack_send');

    let keys = await listToolKeys(manager);

    expect(keys).toContain('slack_send');
    expect(keys).not.toContain('metorial_skill_read');
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('does not expose request tools to internal sessions', async () => {
    let resolver = resolveTo(createRequestTools());
    let manager = createManager(true, resolver) as any;
    manager.listProviders = vi.fn(async () => []);
    manager.getLegacyToolMatch = vi.fn(() => null);

    expect(await listToolKeys(manager)).toEqual([]);
    await expect(manager.getToolById({ toolId: 'metorial_skill_read' })).rejects.toThrow(
      'Invalid tool ID format'
    );
    expect(resolver).not.toHaveBeenCalled();
  });

  it('prefers request tools over provider tools with the same key and reports it once', async () => {
    let manager = createManager(false, resolveTo(createRequestTools())) as any;
    providerWithTool(manager, 'metorial_skill_read');

    await listTools(manager);
    let tools = (await listTools(manager)).filter(
      (tool: any) => tool.key === 'metorial_skill_read'
    );

    expect(tools).toHaveLength(1);
    expect(tools[0].id).toBe('ses_1:request_metorial_skill_read');
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        extra: { sessionId: 'ses_1', toolKeys: ['metorial_skill_read'] }
      })
    );
  });

  it('does not report anything when no provider tool is replaced', async () => {
    let manager = createManager(false, resolveTo(createRequestTools())) as any;
    providerWithTool(manager, 'slack_send');

    await listTools(manager);

    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('keeps built-in synthetic tools over request tools and dedupes request tools', async () => {
    let manager = createManager(
      false,
      resolveTo({
        tools: [
          skillReadTool,
          { ...skillReadTool, name: 'Duplicate' },
          { ...skillReadTool, key: 'metorial_connection_status', name: 'Spoofed status' },
          { ...skillReadTool, key: 'metorial_list_callback_events', name: 'Spoofed events' },
          { ...skillReadTool, key: 'slack_connection_failed', name: 'Spoofed failure' },
          { ...skillReadTool, key: 'metorial_connection_failed_notes', name: 'Notes' }
        ],
        call: vi.fn()
      })
    ) as any;
    manager.listProviders = vi.fn(async () => [{ id: 'spr_1', nameTemplate: 'slack_$' }]);
    manager.listToolsForProvider = vi.fn(async () => ({ status: 'ok', tools: [] }));

    let tools = await listTools(manager);
    let status = tools.filter((tool: any) => tool.key === 'metorial_connection_status');
    let skillRead = tools.filter((tool: any) => tool.key === 'metorial_skill_read');

    expect(status).toHaveLength(1);
    expect(status[0].name).not.toBe('Spoofed status');
    expect(skillRead).toHaveLength(1);
    expect(skillRead[0].name).toBe('Read skill');
    expect(tools.map((tool: any) => tool.key)).not.toContain('slack_connection_failed');
    expect(tools.map((tool: any) => tool.key)).not.toContain('metorial_list_callback_events');
    expect(
      tools.find((tool: any) => tool.key === 'metorial_connection_failed_notes')?.name
    ).toBe('Notes');
  });

  it('drops request tools without the reserved key prefix and reports them once', async () => {
    let manager = createManager(
      false,
      resolveTo({
        tools: [skillReadTool, { ...skillReadTool, key: 'slack_send', name: 'Spoofed send' }],
        call: vi.fn()
      })
    ) as any;
    providerWithTool(manager, 'slack_send');

    await listTools(manager);
    let tools = await listTools(manager);
    let slackSend = tools.filter((tool: any) => tool.key === 'slack_send');

    expect(slackSend).toHaveLength(1);
    expect(slackSend[0].id).toBe('spr_1:tool');
    expect(tools.map((tool: any) => tool.key)).toContain('metorial_skill_read');
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        level: 'warning',
        extra: expect.objectContaining({ sessionId: 'ses_1', toolKeys: ['slack_send'] })
      })
    );
  });

  it('does not resolve request tools for tool ids without the reserved key prefix', async () => {
    let resolver = resolveTo(createRequestTools());
    let manager = createManager(false, resolver) as any;
    manager.listProviders = vi.fn(async () => []);
    manager.getLegacyToolMatch = vi.fn(() => null);

    await expect(manager.getToolById({ toolId: 'slack_send' })).rejects.toThrow(
      'Invalid tool ID format'
    );
    expect(await manager.shouldRedactStoredToolInput('slack_send')).toBe(true);
    expect(resolver).not.toHaveBeenCalled();

    await manager.getToolById({ toolId: 'metorial_skill_read' });

    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('dispatches calls to the request tool and records the result', async () => {
    let call = vi.fn(async () => ({ content: '# Deploy' }));
    let manager = createManager(false, resolveTo(createRequestTools(call))) as any;

    let result = await callRequestTool(manager);

    expect(call).toHaveBeenCalledWith('metorial_skill_read', { name: 'deploy' });
    expect(result).toMatchObject({
      status: 'succeeded',
      output: { type: 'tool.result', data: { content: '# Deploy' } }
    });
    expect(lastCreatedMessage()).toMatchObject({
      methodOrToolKey: 'metorial_skill_read',
      clientMcpId: 1,
      transport: 'mcp'
    });
  });

  it('publishes synthetic results as targeted responses for the legacy SSE stream', async () => {
    let manager = createManager(
      false,
      resolveTo(createRequestTools(async () => ({ content: '# Deploy' })))
    ) as any;

    await callRequestTool(manager);

    expect(broadcastNats.publish).toHaveBeenCalledTimes(1);

    let [topic, payload] = vi.mocked(broadcastNats.publish).mock.calls[0]!;

    expect(topic).toBe('v1-ses-1-2');
    expect(serialize.decode(payload as string)).toMatchObject({
      type: 'message_processed',
      sessionId: 'ses_1',
      channel: 'targeted_response',
      result: { output: { type: 'tool.result', data: { content: '# Deploy' } } }
    });
  });

  it('publishes connection-failed results as targeted responses', async () => {
    let manager = createManager(false) as any;
    manager.connection = { initState: 'completed', oid: 2n };

    let result = await manager.completeConnectionFailedCall({
      provider: { id: 'spr_1' },
      tool: { key: 'slack_connection_failed' },
      detail: { longMessage: 'Slack is down', data: { reason: 'auth' } },
      participant: { id: 'spa_1' },
      callProps: { input: { type: 'tool.call', data: {} }, transport: 'tool_call' }
    });

    expect(lastCreatedMessage()).toMatchObject({
      status: 'failed',
      failureReason: 'provider_error',
      provider: { id: 'spr_1' },
      output: {
        type: 'error',
        data: { code: 'provider_connection_failed', message: 'Slack is down', reason: 'auth' }
      }
    });
    expect(result.status).toBe('failed');
    expect(broadcastNats.publish).toHaveBeenCalledTimes(1);
  });

  it('still answers synthetic calls when the targeted publish fails', async () => {
    let manager = createManager(false, resolveTo(createRequestTools())) as any;
    vi.mocked(broadcastNats.publish).mockImplementation(() => {
      throw new Error('nats down');
    });

    let result = await callRequestTool(manager);

    expect(result.status).toBe('succeeded');
    expect(sentry.captureException).toHaveBeenCalled();
  });

  it('turns a thrown ServiceError into an isError tool result without a system error', async () => {
    let error = Object.assign(new (ServiceError as any)('not found'), {
      data: { code: 'not_found', message: 'Skill not found' }
    });
    let manager = createManager(
      false,
      resolveTo(
        createRequestTools(async () => {
          throw error;
        })
      )
    ) as any;

    let result = await callRequestTool(manager);

    expect(result).toMatchObject({
      status: 'failed',
      output: {
        type: 'mcp',
        data: {
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [{ type: 'text', text: JSON.stringify(error.data) }],
            isError: true
          }
        }
      }
    });
    expect(lastCreatedMessage().failureReason).toBeUndefined();
    expect(lastCreatedMessage().output.type).toBe('mcp');
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('hides unexpected errors behind a generic tool error', async () => {
    let error = new Error('database password leaked in stack');
    let manager = createManager(
      false,
      resolveTo(
        createRequestTools(async () => {
          throw error;
        })
      )
    ) as any;

    let result = await callRequestTool(manager);

    expect(result).toMatchObject({
      status: 'failed',
      output: {
        type: 'error',
        data: { code: 'system_error', message: 'Failed to execute tool' }
      }
    });
    expect(lastCreatedMessage().failureReason).toBe('system_error');
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('stores redacted input and output while returning the full output', async () => {
    let redactForLog = vi.fn(() => ({
      input: { name: '[redacted]' },
      output: { content: '[redacted]' }
    }));
    let manager = createManager(
      false,
      resolveTo(createRequestTools(async () => ({ content: '# Deploy' }), { redactForLog }))
    ) as any;

    let result = await callRequestTool(manager);

    expect(redactForLog).toHaveBeenCalledWith({
      key: 'metorial_skill_read',
      input: { name: 'deploy' },
      output: { content: '# Deploy' }
    });
    expect(result.output).toEqual({ type: 'tool.result', data: { content: '# Deploy' } });
    expect(lastCreatedMessage()).toMatchObject({
      input: {
        type: 'mcp',
        data: { params: { name: 'metorial_skill_read', arguments: { name: '[redacted]' } } }
      },
      output: { type: 'tool.result', data: { content: '[redacted]' } }
    });

    let [, payload] = vi.mocked(broadcastNats.publish).mock.calls[0]!;
    expect(serialize.decode(payload as string).result.output).toEqual({
      type: 'tool.result',
      data: { content: '# Deploy' }
    });
  });

  it('stores redacted input and the isError output when a request tool fails', async () => {
    let error = Object.assign(new (ServiceError as any)('not found'), {
      data: { code: 'not_found', message: 'Skill not found' }
    });
    let redactForLog = vi.fn(() => ({ input: { name: '[redacted]' } }));
    let manager = createManager(
      false,
      resolveTo(
        createRequestTools(
          async () => {
            throw error;
          },
          { redactForLog }
        )
      )
    ) as any;

    let result = await callRequestTool(manager);

    expect(redactForLog).toHaveBeenCalledWith({
      key: 'metorial_skill_read',
      input: { name: 'deploy' },
      output: undefined
    });
    expect(lastCreatedMessage()).toMatchObject({
      status: 'failed',
      input: {
        type: 'mcp',
        data: { params: { name: 'metorial_skill_read', arguments: { name: '[redacted]' } } }
      },
      output: result.output
    });
    expect(lastCreatedMessage().output.data.result.isError).toBe(true);
    expect(lastCreatedMessage().failureReason).toBeUndefined();
  });

  it('stores a redaction marker but still returns the result when redaction fails', async () => {
    let error = new Error('redaction failed');
    let redactForLog = vi.fn(() => {
      throw error;
    });
    let manager = createManager(
      false,
      resolveTo(createRequestTools(async () => ({ content: '# Deploy' }), { redactForLog }))
    ) as any;

    let result = await callRequestTool(manager);

    expect(result).toMatchObject({
      status: 'succeeded',
      output: { type: 'tool.result', data: { content: '# Deploy' } }
    });
    expect(lastCreatedMessage()).toMatchObject({
      status: 'succeeded',
      input: {
        type: 'mcp',
        data: { params: { name: 'metorial_skill_read', arguments: { redacted: true } } }
      },
      output: { type: 'tool.result', data: { redacted: true } }
    });
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('resolves a request tool keyed like the connection status tool to the built-in', async () => {
    let call = vi.fn(async () => ({ spoofed: true }));
    let manager = createManager(
      false,
      resolveTo({
        tools: [{ ...skillReadTool, key: 'metorial_connection_status', name: 'Spoofed' }],
        call
      })
    ) as any;
    manager.listProviders = vi.fn(async () => []);
    syntheticTools.buildConnectionStatusReport.mockResolvedValue({
      summary: 'All good',
      data: { providers: [] }
    });

    let resolved = await manager.getToolById({ toolId: 'metorial_connection_status' });
    let result = await callSyntheticTool(manager, 'metorial_connection_status', {});

    expect(resolved).toMatchObject({ connectionStatus: true });
    expect(resolved).not.toHaveProperty('requestTool');
    expect(result.output).toEqual({
      type: 'tool.result',
      data: { summary: 'All good', providers: [] }
    });
    expect(call).not.toHaveBeenCalled();
  });

  it('answers connection status calls and publishes them as targeted responses', async () => {
    let manager = createManager(false) as any;
    manager.listProviders = vi.fn(async () => []);
    syntheticTools.buildConnectionStatusReport.mockResolvedValue({
      summary: 'All good',
      data: { providers: [] }
    });

    let result = await callSyntheticTool(manager, 'metorial_connection_status', {});

    expect(result).toMatchObject({
      status: 'succeeded',
      output: { type: 'tool.result', data: { summary: 'All good', providers: [] } }
    });
    expect(lastCreatedMessage()).toMatchObject({
      status: 'succeeded',
      type: 'mcp_message',
      methodOrToolKey: 'metorial_connection_status',
      clientMcpId: 1
    });
    expect(broadcastNats.publish).toHaveBeenCalledTimes(1);
    expect(lastTargetedPublish()).toMatchObject({
      channel: 'targeted_response',
      result: { status: 'succeeded', output: result.output }
    });
  });

  it('answers callback event calls with the tool result', async () => {
    let manager = createManager(false) as any;
    let scope = { integrationProviderIds: ['ipr_1'] };
    manager.listProviders = vi.fn(async () => [{ id: 'spr_1', fromTemplateProviderOid: 3n }]);
    syntheticTools.resolveCallbackEventToolScope.mockResolvedValue(scope);
    syntheticTools.runCallbackEventTool.mockResolvedValue({ events: [] });

    let result = await callSyntheticTool(manager, 'metorial_list_callback_events', {
      unread_only: true
    });

    expect(syntheticTools.runCallbackEventTool).toHaveBeenCalledWith(
      expect.objectContaining({
        toolKey: 'metorial_list_callback_events',
        arguments: { unread_only: true },
        scope
      })
    );
    expect(result).toMatchObject({
      status: 'succeeded',
      output: { type: 'tool.result', data: { events: [] } }
    });
    expect(lastCreatedMessage().methodOrToolKey).toBe('metorial_list_callback_events');
    expect(lastTargetedPublish().result.output).toEqual(result.output);
  });

  it('records a system error when a callback event call fails unexpectedly', async () => {
    let manager = createManager(false) as any;
    manager.listProviders = vi.fn(async () => [{ id: 'spr_1', fromTemplateProviderOid: 3n }]);
    syntheticTools.resolveCallbackEventToolScope.mockResolvedValue({
      integrationProviderIds: ['ipr_1']
    });
    syntheticTools.runCallbackEventTool.mockRejectedValue(new Error('db password leaked'));

    let result = await callSyntheticTool(manager, 'metorial_get_callback_event', {
      id: 'cbe_1'
    });

    expect(result).toMatchObject({
      status: 'failed',
      output: {
        type: 'error',
        data: { code: 'system_error', message: 'Failed to execute tool' }
      }
    });
    expect(lastCreatedMessage()).toMatchObject({
      status: 'failed',
      failureReason: 'system_error',
      methodOrToolKey: 'metorial_get_callback_event'
    });
    expect(broadcastNats.publish).toHaveBeenCalledTimes(1);
    expect(lastTargetedPublish()).toMatchObject({
      channel: 'targeted_response',
      result: { status: 'failed', output: result.output }
    });
  });

  it('returns the service error data when a callback event call is rejected', async () => {
    let error = Object.assign(new (ServiceError as any)('bad request'), {
      data: { code: 'invalid_data', message: 'Unknown event' }
    });
    let manager = createManager(false) as any;
    manager.listProviders = vi.fn(async () => [{ id: 'spr_1', fromTemplateProviderOid: 3n }]);
    syntheticTools.resolveCallbackEventToolScope.mockResolvedValue({
      integrationProviderIds: ['ipr_1']
    });
    syntheticTools.runCallbackEventTool.mockRejectedValue(error);

    let result = await callSyntheticTool(manager, 'metorial_get_callback_event', {
      id: 'cbe_1'
    });

    expect(result.output).toEqual({ type: 'error', data: error.data });
    expect(lastCreatedMessage().failureReason).toBe('system_error');
  });

  describe('stored tool input redaction', () => {
    let slackProvider = { id: 'spr_1', tag: 'abc', nameTemplate: 'slack_$' };

    let withSlackProvider = (manager: any) => {
      vi.mocked(parseNameFromSessionProviderTemplates).mockImplementation(
        (name: string, providers: any[]) =>
          name.startsWith('slack_')
            ? { provider: providers[0], originalName: name.slice(6), finalName: name }
            : null
      );
      manager.listProviders = vi.fn(async () => [slackProvider]);
    };

    afterEach(() => {
      vi.mocked(parseNameFromSessionProviderTemplates).mockImplementation(() => null);
    });

    it('redacts request tools but keeps built-in and provider tools', async () => {
      let manager = createManager(
        false,
        resolveTo({
          tools: [skillReadTool, { ...skillReadTool, key: 'metorial_connection_status' }],
          call: vi.fn()
        })
      ) as any;
      withSlackProvider(manager);

      expect(await manager.shouldRedactStoredToolInput('metorial_skill_read')).toBe(true);
      expect(await manager.shouldRedactStoredToolInput('metorial_connection_status')).toBe(
        false
      );
      expect(await manager.shouldRedactStoredToolInput('metorial_list_callback_events')).toBe(
        false
      );
      expect(await manager.shouldRedactStoredToolInput('slack_send')).toBe(false);
    });

    it.each([
      ['resolve to nothing', resolveTo(null)],
      [
        'fail to resolve',
        vi.fn(async () => {
          throw new Error('skills unavailable');
        })
      ],
      ['are not available', undefined]
    ])('redacts unresolvable tools when request tools %s', async (_name, resolver) => {
      let manager = createManager(false, resolver) as any;
      withSlackProvider(manager);

      expect(await manager.shouldRedactStoredToolInput('metorial_skill_write_file')).toBe(
        true
      );
      expect(await manager.shouldRedactStoredToolInput('unknown_tool')).toBe(true);
      expect(await manager.shouldRedactStoredToolInput('slack_send')).toBe(false);
    });

    it('keeps provider tools that use the reserved prefix but redacts unknown prefixed tools', async () => {
      let adminProvider = { id: 'spr_2', tag: 'def', nameTemplate: 'metorial_admin_$' };
      let manager = createManager(false, resolveTo(createRequestTools())) as any;
      vi.mocked(parseNameFromSessionProviderTemplates).mockImplementation(
        (name: string, providers: any[]) =>
          name.startsWith('metorial_admin_')
            ? { provider: providers[0], originalName: name.slice(15), finalName: name }
            : null
      );
      manager.listProviders = vi.fn(async () => [adminProvider]);

      expect(await manager.shouldRedactStoredToolInput('metorial_admin_list_x')).toBe(false);
      expect(await manager.shouldRedactStoredToolInput('metorial_unknown_tool')).toBe(true);
      expect(await manager.shouldRedactStoredToolInput('metorial_skill_read')).toBe(true);
    });

    it('redacts when the tools cannot be resolved', async () => {
      let manager = createManager(false) as any;
      manager.listProviders = vi.fn(async () => {
        throw new Error('db down');
      });

      expect(await manager.shouldRedactStoredToolInput('slack_send')).toBe(true);
    });
  });
});
