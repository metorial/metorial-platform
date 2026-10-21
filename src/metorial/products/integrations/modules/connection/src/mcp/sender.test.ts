import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: vi.fn(() => ({ captureException: vi.fn() }))
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {},
  messageTranslator: {}
}));

vi.mock('@metorial-subspace/module-session', () => ({
  applySessionProviderNameTemplate: vi.fn(),
  parseNameFromSessionProviderTemplates: vi.fn()
}));

vi.mock('@metorial-subspace/connection-utils', () => ({
  checkResourceAccessManager: vi.fn(),
  conduitResultToMcpMessage: vi.fn(async (result: any) => result.output?.data ?? null),
  markdownList: vi.fn(),
  mcpValidate: (id: any, schema: any, data: unknown) => {
    let res = schema.safeParse(data);
    if (res.success) return { success: true, data: res.data };

    return {
      success: false,
      error: { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params' } }
    };
  }
}));

vi.mock('../shared/upsertParticipant', () => ({
  upsertParticipant: vi.fn(async () => ({ oid: 1n, id: 'spar_system' }))
}));

vi.mock('../lib/mcpOutputSchemaNormalizer', () => ({ mcpOutputSchemaNormalizer: {} }));
vi.mock('../presenter', () => ({ providerToolPresenter: vi.fn() }));
vi.mock('../shared/toolCallOperation', () => ({
  injectToolCallOperationIntoInputSchema: vi.fn()
}));

vi.mock('./control', () => ({
  getMcpProgressToken: vi.fn(() => null)
}));

import { McpSender } from './sender';

let createSender = (d: { redactedToolKeys: string[]; callTool?: () => Promise<any> }) => {
  let createMessage = vi.fn(async (props: any) => ({
    id: 'smsg_1',
    status: props.status,
    output: props.output,
    completedAt: null
  }));

  let manager = {
    session: { oid: 1n, id: 'ses_1', isInternal: false },
    connection: { participant: { oid: 2n, id: 'spar_client' } },
    tenant: {},
    shouldRedactStoredToolInput: vi.fn(async (key: string) =>
      d.redactedToolKeys.includes(key)
    ),
    callTool: vi.fn(d.callTool ?? (async () => ({}))),
    createMessage
  };

  let control = { sendControlMessage: vi.fn(async () => {}) };
  let sender = new McpSender('streamable_http' as any, manager as any, control as any);

  return { sender, createMessage };
};

let writeFileCall = (args: unknown) => ({
  jsonrpc: '2.0' as const,
  id: 7,
  method: 'tools/call',
  params: { name: 'metorial_skill_write_file', arguments: args }
});

describe('McpSender stored tool call input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('redacts malformed request tool calls before storing them', async () => {
    let { sender, createMessage } = createSender({
      redactedToolKeys: ['metorial_skill_write_file']
    });

    await sender.handleMessage(writeFileCall('secret skill content') as any, {
      waitForResponse: true
    });

    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(createMessage.mock.calls[0]![0].input).toEqual({
      type: 'mcp',
      data: {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'metorial_skill_write_file', redacted: true }
      }
    });
  });

  it('redacts request tool calls whose execution throws', async () => {
    let { sender, createMessage } = createSender({
      redactedToolKeys: ['metorial_skill_write_file'],
      callTool: async () => {
        throw new Error('boom');
      }
    });

    await sender.handleMessage(
      writeFileCall({ skill: 'skill_1', path: '/SKILL.md', content: 'secret' }) as any,
      { waitForResponse: true }
    );

    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(createMessage.mock.calls[0]![0]).toMatchObject({
      type: 'unknown',
      failureReason: 'system_error',
      input: { data: { params: { name: 'metorial_skill_write_file', redacted: true } } }
    });
    expect(JSON.stringify(createMessage.mock.calls[0]![0].input)).not.toContain('secret');
  });

  it('redacts tool calls without a tool name', async () => {
    let { sender, createMessage } = createSender({ redactedToolKeys: [] });

    await sender.handleMessage(
      {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: { name: 42, arguments: { content: 'secret' } }
      } as any,
      { waitForResponse: true }
    );

    expect(createMessage.mock.calls[0]![0].input).toEqual({
      type: 'mcp',
      data: { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { redacted: true } }
    });
  });

  it('keeps the raw input for other tools', async () => {
    let { sender, createMessage } = createSender({ redactedToolKeys: [] });
    let msg = {
      jsonrpc: '2.0' as const,
      id: 8,
      method: 'tools/call',
      params: { name: 'provider_tool', arguments: 'not an object' }
    };

    await sender.handleMessage(msg as any, { waitForResponse: true });

    expect(createMessage.mock.calls[0]![0].input).toEqual({ type: 'mcp', data: msg });
  });
});
