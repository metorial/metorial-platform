import { badRequestError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  completeMessage: vi.fn(),
  upsertParticipant: vi.fn(async () => ({ oid: 1n, id: 'spar_system' })),
  parseNameFromSessionProviderTemplates: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn() })
}));
vi.mock('@metorial-subspace/db', () => ({
  db: {},
  dbPrimary: { sessionMessage: { findFirst: vi.fn() } },
  messageTranslator: { outputToMcpBasic: vi.fn(async () => null) }
}));
vi.mock('@metorial-subspace/connection-utils', () => ({
  checkResourceAccessManager: () => () => ({ allowed: true }),
  conduitResultToMcpMessage: vi.fn(async () => ({ jsonrpc: '2.0', id: 1, result: {} })),
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
  parseNameFromSessionProviderTemplates: mocks.parseNameFromSessionProviderTemplates
}));
vi.mock('../lib/mcpOutputSchemaNormalizer', () => ({ mcpOutputSchemaNormalizer: vi.fn() }));
vi.mock('../presenter', () => ({ providerToolPresenter: vi.fn() }));
vi.mock('../shared/completeMessage', () => ({ completeMessage: mocks.completeMessage }));
vi.mock('../shared/upsertParticipant', () => ({ upsertParticipant: mocks.upsertParticipant }));
vi.mock('../shared/toolCallOperation', () => ({
  injectToolCallOperationIntoInputSchema: vi.fn()
}));
vi.mock('./control', () => ({ getMcpProgressToken: () => null }));

import { McpSender } from './sender';

let refundsSkill = {
  uri: 'skill://refunds/SKILL.md',
  frontmatter: { name: 'refunds', description: 'Process refunds' },
  resources: [
    { uri: 'skill://refunds/SKILL.md', digest: 'sha256:aa', size: 120 },
    { uri: 'skill://refunds/references/policy.md', digest: 'sha256:bb', size: 40 }
  ]
};

let createSkills = () => ({
  listSkills: vi.fn(async (_d: { cursor?: string }) => ({
    skills: [refundsSkill],
    nextCursor: undefined as string | undefined
  })),
  listSkillDocuments: vi.fn(async (_d: { cursor?: string }) => ({
    documents: [
      {
        uri: refundsSkill.uri,
        name: 'refunds',
        description: 'Process refunds',
        size: 120
      }
    ],
    nextCursor: undefined as string | undefined
  })),
  getSkill: vi.fn(async ({ uri }: { uri: string }) =>
    uri === refundsSkill.uri ? refundsSkill : null
  ),
  readResource: vi.fn(async ({ uri }: { uri: string }) =>
    uri === refundsSkill.uri ? { uri, mimeType: 'text/markdown', text: '---\n---\n' } : null
  ),
  readDirectory: vi.fn(async ({ uri }: { uri: string }) =>
    uri === 'skill://refunds/references'
      ? {
          resources: [
            {
              uri: 'skill://refunds/references/policy.md',
              name: 'policy.md',
              mimeType: 'text/markdown',
              size: 40
            }
          ]
        }
      : null
  )
});

let providerResourcesTool = {
  key: 'resources_list',
  value: { mcpToolType: { type: 'mcp.resources_list' } },
  sessionProvider: { id: 'sp_1', nameTemplate: 'slack' }
};

let createManager = (skills: ReturnType<typeof createSkills> | null) => ({
  session: { oid: 1n, isInternal: false },
  connection: { participant: { oid: 2n } },
  tenant: {},
  getRequestSkills: vi.fn(async () => skills),
  initialize: vi.fn(async () => undefined),
  listProviders: vi.fn(async () => []),
  createMessage: vi.fn(async () => ({ id: 'msg_parent', oid: 1n })),
  listToolsIncludingInternalAndNonAllowed: vi.fn(async () => ({
    tools: [providerResourcesTool]
  })),
  callTool: vi.fn(async () => ({
    status: 'succeeded',
    message: null,
    output: {
      type: 'mcp',
      data: {
        jsonrpc: '2.0',
        id: 'x',
        result: { resources: [{ uri: 'file://a', name: 'a' }] }
      }
    }
  }))
});

let createSender = (skills: ReturnType<typeof createSkills> | null) => {
  let manager = createManager(skills);
  let control = { sendControlMessage: vi.fn(async () => undefined) };
  let sender = new McpSender('streamable_http', manager as any, control as any);

  return { sender, manager, control };
};

let request = (method: string, params: Record<string, unknown> = {}) => ({
  jsonrpc: '2.0' as const,
  id: 1,
  method,
  params
});

let initializeRequest = request('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'test', version: '1.0.0' }
});

describe('McpSender skills extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.completeMessage.mockImplementation(async (_filter, data) => ({
      id: 'msg_parent',
      status: data.status,
      output: data.output,
      completedAt: new Date()
    }));
  });

  it('declares the skills extension on initialize when the endpoint serves skills', async () => {
    let { sender } = createSender(createSkills());

    let res = await sender.handleMessage(initializeRequest, { waitForResponse: true });

    expect(res?.mcp).toMatchObject({
      result: {
        capabilities: {
          resources: {},
          extensions: { 'io.modelcontextprotocol/skills': { directoryRead: true } }
        }
      }
    });
  });

  it('does not declare the skills extension without a skill catalog', async () => {
    let { sender } = createSender(null);

    let res = await sender.handleMessage(initializeRequest, { waitForResponse: true });

    expect((res?.mcp as any).result.capabilities).toEqual({
      tools: {},
      prompts: {},
      resources: {}
    });
  });

  it('lists skills without storing them on the shared session', async () => {
    let skills = createSkills();
    skills.listSkills.mockResolvedValueOnce({ skills: [refundsSkill], nextCursor: '20' });
    let { sender, manager } = createSender(skills);

    let res = await sender.handleMessage(request('skills/list', { cursor: '0' }), {
      waitForResponse: true
    });

    expect(skills.listSkills).toHaveBeenCalledWith({ cursor: '0' });
    expect(res?.mcp).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { resultType: 'complete', skills: [refundsSkill], nextCursor: '20' }
    });
    expect(manager.createMessage).not.toHaveBeenCalled();
  });

  it('returns a single skill entry from skills/get', async () => {
    let { sender } = createSender(createSkills());

    let res = await sender.handleMessage(
      request('skills/get', { uri: 'skill://refunds/SKILL.md' }),
      { waitForResponse: true }
    );

    expect(res?.mcp).toMatchObject({
      result: { resultType: 'complete', skill: refundsSkill }
    });
  });

  it.each([
    ['an unknown skill', { uri: 'skill://unknown/SKILL.md' }],
    ['a missing uri', {}]
  ])('rejects skills/get for %s with invalid params', async (_name, params) => {
    let { sender } = createSender(createSkills());

    let res = await sender.handleMessage(request('skills/get', params), {
      waitForResponse: true
    });

    expect(res?.mcp).toMatchObject({ error: { code: -32602 } });
  });

  it('turns catalog errors into invalid params', async () => {
    let skills = createSkills();
    skills.listSkills.mockRejectedValueOnce(
      new ServiceError(badRequestError({ message: 'Invalid cursor' }))
    );
    let { sender } = createSender(skills);

    let res = await sender.handleMessage(request('skills/list', { cursor: 'x' }), {
      waitForResponse: true
    });

    expect(res?.mcp).toMatchObject({ error: { code: -32602, message: 'Invalid cursor' } });
  });

  it.each(['skills/list', 'skills/get', 'resources/directory/read'])(
    'answers %s with method not found when the endpoint serves no skills',
    async method => {
      let { sender } = createSender(null);

      let res = await sender.handleMessage(request(method), { waitForResponse: true });

      expect(res?.mcp).toMatchObject({ error: { code: -32601 } });
    }
  );

  it('lists the direct children of a skill directory', async () => {
    let { sender } = createSender(createSkills());

    let res = await sender.handleMessage(
      request('resources/directory/read', { uri: 'skill://refunds/references' }),
      { waitForResponse: true }
    );

    expect(res?.mcp).toMatchObject({
      result: {
        resources: [{ uri: 'skill://refunds/references/policy.md', name: 'policy.md' }]
      }
    });
  });

  it('reads skill:// resources from the catalog instead of a provider', async () => {
    let { sender, manager } = createSender(createSkills());

    let res = await sender.handleMessage(
      request('resources/read', { uri: 'skill://refunds/SKILL.md' }),
      { waitForResponse: true }
    );

    expect(res?.mcp).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        contents: [
          { uri: 'skill://refunds/SKILL.md', mimeType: 'text/markdown', text: '---\n---\n' }
        ]
      }
    });
    expect(mocks.parseNameFromSessionProviderTemplates).not.toHaveBeenCalled();
    expect(manager.createMessage).not.toHaveBeenCalled();
  });

  it('falls through to providers for skill:// URIs outside the catalog', async () => {
    let { sender } = createSender(createSkills());
    mocks.parseNameFromSessionProviderTemplates.mockReturnValue(null);

    let res = await sender.handleMessage(
      request('resources/read', { uri: 'skill://upstream/SKILL.md' }),
      { waitForResponse: true }
    );

    expect(mocks.parseNameFromSessionProviderTemplates).toHaveBeenCalled();
    expect(res?.mcp).toMatchObject({
      error: { message: 'No provider found for resource URI' }
    });
  });

  it('turns catalog read errors into invalid params', async () => {
    let skills = createSkills();
    skills.readResource.mockRejectedValueOnce(
      new ServiceError(badRequestError({ message: 'Forbidden skill' }))
    );
    let { sender } = createSender(skills);

    let res = await sender.handleMessage(
      request('resources/read', { uri: 'skill://refunds/SKILL.md' }),
      { waitForResponse: true }
    );

    expect(res?.mcp).toMatchObject({ error: { code: -32602, message: 'Forbidden skill' } });
  });

  it('lists skill resources first, then continues with provider resources', async () => {
    let { sender, manager } = createSender(createSkills());

    let first = await sender.handleMessage(request('resources/list'), {
      waitForResponse: true
    });
    let firstResult = (first?.mcp as any).result;

    expect(firstResult.resources).toEqual([
      {
        uri: 'skill://refunds/SKILL.md',
        name: 'refunds',
        description: 'Process refunds',
        mimeType: 'text/markdown',
        size: 120
      }
    ]);
    expect(firstResult.nextCursor).toBeTypeOf('string');
    expect(manager.createMessage).not.toHaveBeenCalled();

    let second = await sender.handleMessage(
      request('resources/list', { cursor: firstResult.nextCursor }),
      { waitForResponse: true }
    );

    expect((second?.mcp as any).result.resources).toEqual([{ uri: 'file://a', name: 'a' }]);
  });

  it('pages through skill resources before moving on to providers', async () => {
    let skills = createSkills();
    skills.listSkillDocuments.mockResolvedValueOnce({
      documents: [{ uri: refundsSkill.uri, name: 'refunds', size: 120 }],
      nextCursor: '20'
    });
    let { sender } = createSender(skills);

    let first = await sender.handleMessage(request('resources/list'), {
      waitForResponse: true
    });
    let cursor = (first?.mcp as any).result.nextCursor;

    await sender.handleMessage(request('resources/list', { cursor }), {
      waitForResponse: true
    });

    expect(skills.listSkillDocuments).toHaveBeenLastCalledWith({ cursor: '20' });
    expect(skills.listSkills).not.toHaveBeenCalled();
  });
});
