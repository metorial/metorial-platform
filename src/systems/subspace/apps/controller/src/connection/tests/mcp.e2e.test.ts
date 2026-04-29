import { createHono } from '@lowerdeck/hono';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { describe, expect, it } from 'vitest';
import { createMcpE2eContext } from '../../test/fixtures';
import { createHonoFetchAdapter } from '../../test/helpers/honoFetchAdapter';
import { createMcpTestClient } from '../../test/helpers/mcpClientFactory';
import { setupMcpE2ELifecycle } from '../../test/helpers/mcpE2ELifecycle';
import { testDb } from '../../test/setup';
import { mcpRouter } from '../api/mcp';

let transportCases = [
  {
    name: 'streamable_http',
    providerProtocol: 'streamable_http',
    upstreamPath: '/full/mcp',
    clientTransport: 'streamable_http'
  },
  {
    name: 'sse',
    providerProtocol: 'sse',
    upstreamPath: '/full/sse',
    clientTransport: 'sse'
  }
] as const;

let defaultTransportCase = transportCases[0];

describe('mcp.e2e', () => {
  let lifecycle = setupMcpE2ELifecycle();
  let api = createHono().route('/:solutionId/:tenantId/sessions/:sessionId/mcp', mcpRouter);
  let localFetch = createHonoFetchAdapter(api);

  it.each(transportCases)(
    'initializes and calls a tool via a real MCP connection over $name',
    { timeout: 120_000 },
    async transportCase => {
      let ctx = await createMcpE2eContext(testDb, {
        remoteServerBaseUrl: lifecycle.getRemoteServerBaseUrl(),
        transportCase
      });

      let mcp = createMcpTestClient({
        baseUrl: ctx.proxyUrl,
        transportType: transportCase.clientTransport,
        fetch: localFetch
      });

      try {
        await mcp.connect();

        if (mcp.transport instanceof StreamableHTTPClientTransport) {
          expect(mcp.transport.sessionId).toBeTruthy();
        }
        expect(mcp.client.getServerVersion()?.name).toBeTruthy();

        let tools = await mcp.client.listTools();

        let toolNames = tools.tools.map(t => t.name);
        let addTool = toolNames.find(name => /(^|[_.-])add([_.-]|$)/.test(name));
        expect(
          addTool,
          `Expected an add-like tool for ${transportCase.name}. Discovered tools: ${
            toolNames.length ? toolNames.join(', ') : '(none)'
          }`
        ).toBeTruthy();
        let result = await mcp.client.callTool({ name: addTool!, arguments: { a: 1, b: 2 } });
        let text = (
          result as { content?: Array<{ type?: string; text?: string }> }
        ).content?.find(p => p.type === 'text')?.text;

        expect(text).toContain('Result: 3');
      } finally {
        await mcp.cleanup();
      }
    }
  );

  it(
    'continuously narrows deployment and session provider filters across tools, prompts, and resources',
    { timeout: 120_000 },
    async () => {
      let ctx = await createMcpE2eContext(testDb, {
        remoteServerBaseUrl: lifecycle.getRemoteServerBaseUrl(),
        transportCase: defaultTransportCase,
        providerDeploymentToolFilter: {
          type: 'v1.filter',
          filters: [
            { type: 'tool_keys', keys: ['add', 'echo'] },
            { type: 'prompt_keys', keys: ['code_review', 'summarize'] },
            { type: 'resource_regex', pattern: '^test://(data/(users|config)|user/[^/]+)$' }
          ]
        },
        sessionProviderToolFilter: {
          type: 'v1.filter',
          filters: [
            { type: 'tool_keys', keys: ['echo'] },
            { type: 'prompt_keys', keys: ['summarize'] },
            { type: 'resource_regex', pattern: '^test://(data/config|user/[^/]+)$' }
          ]
        }
      });

      let mcp = createMcpTestClient({
        baseUrl: ctx.proxyUrl,
        transportType: defaultTransportCase.clientTransport,
        fetch: localFetch
      });

      try {
        await mcp.connect();

        let tools = await mcp.client.listTools();
        let toolNames = tools.tools.map(t => t.name);
        expect(toolNames.some(name => /echo/.test(name))).toBe(true);
        expect(toolNames.some(name => /add/.test(name))).toBe(false);

        let prompts = await mcp.client.listPrompts();
        let promptNames = prompts.prompts.map(p => p.name);
        expect(promptNames.some(name => /summarize/.test(name))).toBe(true);
        expect(promptNames.some(name => /code_review/.test(name))).toBe(false);

        let resourceTemplates = await mcp.client.listResourceTemplates();
        let templateUris = resourceTemplates.resourceTemplates.map(t => t.uriTemplate);
        expect(templateUris.some(uri => uri.startsWith('test://user/{id}'))).toBe(true);
        expect(templateUris.some(uri => uri.startsWith('test://log/{date}'))).toBe(false);

        let resources = await mcp.client.listResources();
        let resourceUris = resources.resources.map(r => r.uri);
        expect(resourceUris.some(uri => uri.startsWith('test://data/config_'))).toBe(true);
        expect(resourceUris.some(uri => uri.startsWith('test://data/users_'))).toBe(false);

        let configResource = resourceUris.find(uri => uri.startsWith('test://data/config_'));
        expect(configResource).toBeTruthy();

        let configContents = await mcp.client.readResource({ uri: configResource! });
        expect(JSON.stringify(configContents)).toContain('Test Server');
      } finally {
        await mcp.cleanup();
      }
    }
  );

  it(
    'allows session provider filters to overwrite deployment filters when ignoreParentFilters is enabled',
    { timeout: 120_000 },
    async () => {
      let ctx = await createMcpE2eContext(testDb, {
        remoteServerBaseUrl: lifecycle.getRemoteServerBaseUrl(),
        transportCase: defaultTransportCase,
        providerDeploymentToolFilter: {
          type: 'v1.filter',
          filters: [
            { type: 'tool_keys', keys: ['add'] },
            { type: 'prompt_keys', keys: ['code_review'] },
            { type: 'resource_regex', pattern: '^test://data/users$' }
          ]
        },
        sessionProviderToolFilter: {
          type: 'v1.filter',
          ignoreParentFilters: true,
          filters: [
            { type: 'tool_keys', keys: ['echo'] },
            { type: 'prompt_keys', keys: ['summarize'] },
            { type: 'resource_regex', pattern: '^test://data/config$' }
          ]
        }
      });

      let mcp = createMcpTestClient({
        baseUrl: ctx.proxyUrl,
        transportType: defaultTransportCase.clientTransport,
        fetch: localFetch
      });

      try {
        await mcp.connect();

        let tools = await mcp.client.listTools();
        let toolNames = tools.tools.map(t => t.name);
        expect(toolNames.some(name => /echo/.test(name))).toBe(true);
        expect(toolNames.some(name => /add/.test(name))).toBe(false);

        let prompts = await mcp.client.listPrompts();
        let promptNames = prompts.prompts.map(p => p.name);
        expect(promptNames.some(name => /summarize/.test(name))).toBe(true);
        expect(promptNames.some(name => /code_review/.test(name))).toBe(false);

        let resources = await mcp.client.listResources();
        let resourceUris = resources.resources.map(r => r.uri);
        expect(resourceUris.some(uri => uri.startsWith('test://data/config_'))).toBe(true);
        expect(resourceUris.some(uri => uri.startsWith('test://data/users_'))).toBe(false);

        let configResource = resourceUris.find(uri => uri.startsWith('test://data/config_'));
        expect(configResource).toBeTruthy();

        let blockedUsersResource = configResource!.replace(
          'test://data/config_',
          'test://data/users_'
        );

        await expect(mcp.client.readResource({ uri: blockedUsersResource })).rejects.toThrow(
          /Resource access not allowed/
        );
      } finally {
        await mcp.cleanup();
      }
    }
  );

  it(
    'injects $operation into tool schemas and stores extracted tool call metadata',
    { timeout: 120_000 },
    async () => {
      let ctx = await createMcpE2eContext(testDb, {
        remoteServerBaseUrl: lifecycle.getRemoteServerBaseUrl(),
        transportCase: defaultTransportCase
      });

      let mcp = createMcpTestClient({
        baseUrl: ctx.proxyUrl,
        transportType: defaultTransportCase.clientTransport,
        fetch: localFetch
      });

      try {
        await mcp.connect();

        let tools = await mcp.client.listTools();
        let addTool = tools.tools.find(tool => /(^|[_.-])add([_.-]|$)/.test(tool.name));
        expect(addTool).toBeTruthy();

        let operationSchema = (addTool!.inputSchema as any)?.properties?.$operation;
        expect(operationSchema).toMatchObject({
          type: 'object',
          properties: {
            callRationale: expect.objectContaining({
              type: 'string',
              description: expect.stringContaining(
                '1-2 sentence description why the call is needed'
              )
            }),
            callDescription: expect.objectContaining({
              type: 'string',
              description: expect.stringContaining(
                'Describe what the calling agent or client wants to do'
              )
            })
          }
        });
        expect(operationSchema.description).toContain('MUST be provided');

        let result = await mcp.client.callTool({
          name: addTool!.name,
          arguments: {
            a: 1,
            b: 2,
            $operation: {
              callRationale: 'We need the calculator tool to compute the user-requested sum.',
              callDescription: 'Add the two provided numbers and return the result.'
            }
          }
        });
        let text = (
          result as { content?: Array<{ type?: string; text?: string }> }
        ).content?.find(p => p.type === 'text')?.text;

        expect(text).toContain('Result: 3');

        let toolCall = await testDb.toolCall.findFirstOrThrow({
          where: {
            sessionOid: ctx.session.oid,
            rationale: 'We need the calculator tool to compute the user-requested sum.',
            operation: 'Add the two provided numbers and return the result.'
          },
          orderBy: { createdAt: 'desc' },
          include: { message: true }
        });

        expect(toolCall.message.input).toMatchObject({
          type: 'mcp',
          data: {
            params: {
              arguments: {
                a: 1,
                b: 2
              }
            }
          }
        });
        expect(
          (toolCall.message.input as any)?.data?.params?.arguments?.$operation
        ).toBeUndefined();
      } finally {
        await mcp.cleanup();
      }
    }
  );
});
