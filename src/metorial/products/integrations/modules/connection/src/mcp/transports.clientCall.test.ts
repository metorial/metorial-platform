import { beforeEach, describe, expect, it, vi } from 'vitest';

let { manager } = vi.hoisted(() => ({
  manager: {
    session: { oid: 1n, id: 'ses_1', isInternal: false, sharedProviderName: null },
    connection: {
      id: 'scon_1',
      participant: { oid: 2n, id: 'spar_client' },
      mcpData: { clientInfo: { name: 'unknown-client', version: '1.0.0' } }
    },
    tenant: {},
    getConnection: async () => ({ id: 'scon_1' }),
    resolveSessionlessConnection: vi.fn(async () => undefined),
    listProviders: vi.fn(async () => []),
    getRequestSkills: vi.fn(async () => null),
    shouldRedactStoredToolInput: vi.fn(async () => false),
    sendMcpMessageToProvider: vi.fn(async () => undefined),
    createMessage: vi.fn(async (props: any) => ({
      id: 'smsg_1',
      status: props.status,
      output: props.output,
      completedAt: null
    })),
    callTool: vi.fn()
  }
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn() })
}));
vi.mock('@metorial-subspace/db', () => ({
  db: { sessionMessage: { findFirst: vi.fn() } },
  messageTranslator: { outputToMcpBasic: vi.fn(async () => null) }
}));
vi.mock('@metorial-subspace/connection-utils', () => ({
  checkResourceAccessManager: () => () => ({ allowed: true }),
  conduitResultToMcpMessage: vi.fn(async (result: any) => result?.output?.data ?? null),
  markdownList: () => '',
  mcpValidate: (id: any, schema: any, data: unknown) => {
    let res = schema.safeParse(data);
    if (res.success) return { success: true, data: res.data };

    return {
      success: false,
      error: { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params' } }
    };
  }
}));
vi.mock('@metorial-subspace/module-session', () => ({
  applySessionProviderNameTemplate: (_template: string, uri: string) => uri,
  parseNameFromSessionProviderTemplates: vi.fn()
}));
vi.mock('../lib/mcpOutputSchemaNormalizer', () => ({ mcpOutputSchemaNormalizer: vi.fn() }));
vi.mock('../presenter', () => ({ providerToolPresenter: vi.fn() }));
vi.mock('../shared/completeMessage', () => ({ completeMessage: vi.fn() }));
vi.mock('../shared/upsertParticipant', () => ({
  upsertParticipant: vi.fn(async () => ({ oid: 3n, id: 'spar_system' }))
}));
vi.mock('../shared/toolCallOperation', () => ({
  injectToolCallOperationIntoInputSchema: vi.fn()
}));
vi.mock('../lib/topic', () => ({
  topics: { mcpConnection: { encode: () => 'connection-topic' } }
}));
vi.mock('../lib/nats', () => ({
  broadcastNats: {
    publish: vi.fn(async () => undefined),
    subscribe: () => {
      let close!: () => void;
      let closed = new Promise<void>(resolve => (close = resolve));

      return {
        unsubscribe: () => close(),
        async *[Symbol.asyncIterator]() {
          await closed;
        }
      };
    }
  }
}));
vi.mock('./manager', () => ({ McpManager: { create: vi.fn(async () => manager) } }));

import { handleMcpRequest } from './request';
import { parseModernMcpRequest } from './modern/parse';
import { handleSessionlessMcpRequest } from './sessionless';

let codexTurnMetadata = {
  session_id: 'codex-session',
  turn_id: 'codex-turn',
  workspaces: {
    '/home/dev/project': {
      associated_remote_urls: ['git@example.com:org/repo.git'],
      latest_git_commit_hash: 'abc123',
      has_changes: true
    }
  }
};

let codexToolCall = (extraMeta: Record<string, unknown> = {}) => ({
  jsonrpc: '2.0' as const,
  id: 1,
  method: 'tools/call',
  params: {
    name: 'search',
    arguments: { query: 'x' },
    _meta: { callId: 'call_abc', 'x-codex-turn-metadata': codexTurnMetadata, ...extraMeta }
  }
});

let connectionInput = { sessionId: 'ses_1', solutionId: 'sol_1', tenantId: 'ten_1' };

let calledInput = () => (manager.callTool.mock.calls as any[][])[0]![0];

let expectCodexCallWithoutTurnMetadata = () => {
  expect(manager.callTool).toHaveBeenCalledOnce();
  expect(calledInput().clientCall).toEqual({ id: 'call_abc', source: 'codex' });
  expect(calledInput().input.data.params._meta).not.toHaveProperty('x-codex-turn-metadata');
  expect(calledInput().input.data.params._meta.callId).toBe('call_abc');
  expect(JSON.stringify(calledInput().input)).not.toContain('/home/dev/project');
};

describe('client call ids and turn metadata on every transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    manager.callTool.mockResolvedValue({
      status: 'succeeded',
      message: { id: 'smsg_1' },
      output: { type: 'mcp', data: { jsonrpc: '2.0', id: 1, result: { content: [] } } }
    });
  });

  it('strips the turn metadata on SSE posts that do not wait for the response', async () => {
    await handleMcpRequest({
      ...connectionInput,
      mcpTransport: 'sse',
      message: codexToolCall(),
      waitForResponse: false
    });

    expectCodexCallWithoutTurnMetadata();
    expect(calledInput().waitForResponse).toBe(false);
  });

  it('strips the turn metadata on streamable HTTP requests with progress', async () => {
    let onProgress = vi.fn(async () => undefined);

    let { response } = await handleMcpRequest({
      ...connectionInput,
      mcpTransport: 'streamable_http',
      message: codexToolCall({ progressToken: 'p-1' }),
      waitForResponse: true,
      onProgress
    });

    expectCodexCallWithoutTurnMetadata();
    expect(calledInput().input.data.params._meta.progressToken).toBe('p-1');
    expect(response?.mcp).toMatchObject({ id: 1, result: { content: [] } });
  });

  it('strips the turn metadata on sessionless requests and still reads the Codex id', async () => {
    let body = codexToolCall({
      progressToken: 'p-2',
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientCapabilities': {},
      'io.modelcontextprotocol/clientInfo': { name: 'codex-mcp-client', version: '0.170.0' }
    });
    let headers: Record<string, string> = {
      'mcp-protocol-version': '2026-07-28',
      'mcp-method': 'tools/call',
      'mcp-name': 'search'
    };

    let parsed = parseModernMcpRequest({
      body,
      getHeader: name => headers[name.toLowerCase()]
    });
    if (parsed.type !== 'request') throw new Error(`Unexpected parse result ${parsed.type}`);

    let result = await handleSessionlessMcpRequest({
      ...connectionInput,
      request: parsed,
      onProgress: vi.fn(async () => undefined)
    });

    expectCodexCallWithoutTurnMetadata();
    expect(calledInput().input.data.params._meta).toEqual({
      callId: 'call_abc',
      progressToken: 'p-2'
    });
    expect(result.mcp).toMatchObject({ id: 1 });
    expect(
      JSON.stringify(manager.createMessage.mock.calls.map(([props]: any[]) => props.input))
    ).not.toContain('x-codex-turn-metadata');
  });
});
