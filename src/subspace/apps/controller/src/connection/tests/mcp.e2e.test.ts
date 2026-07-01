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

let getStreamableHttpSseMessages = async (response: Response) => {
  let body = await response.text();

  return body
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => JSON.parse(line.slice('data:'.length).trim()));
};

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
    'returns streamable HTTP connection headers from initialize and accepts follow-up calls',
    { timeout: 120_000 },
    async () => {
      let ctx = await createMcpE2eContext(testDb, {
        remoteServerBaseUrl: lifecycle.getRemoteServerBaseUrl(),
        transportCase: defaultTransportCase
      });

      let initializeResponse = await localFetch(ctx.proxyUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'initialize-request',
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: {
              name: 'subspace-e2e',
              version: '1.0.0'
            }
          }
        })
      });

      let sessionId = initializeResponse.headers.get('Mcp-Session-Id');
      let connectionId = initializeResponse.headers.get('Metorial-Connection-Id');
      let connectionToken = initializeResponse.headers.get('Metorial-Connection-Token');
      let initializeMessages = await getStreamableHttpSseMessages(initializeResponse);

      expect(sessionId).toBeTruthy();
      expect(connectionId).toBeTruthy();
      expect(connectionToken).toBeTruthy();
      expect(initializeMessages.find(message => message.id === 'initialize-request')?.result).toBeTruthy();

      let toolsResponse = await localFetch(ctx.proxyUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
          'MCP-Session-ID': sessionId!
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'tool-call-request',
          method: 'tools/call',
          params: {
            name: 'add',
            arguments: {
              a: 1,
              b: 2
            }
          }
        })
      });

      let toolMessages = await getStreamableHttpSseMessages(toolsResponse);
      expect(toolMessages.find(message => message.id === 'tool-call-request')?.result?.content?.[0]?.text).toContain(
        'Result: 3'
      );
    }
  );

  it.each(transportCases)(
    'keeps long-running tool calls alive over $name',
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

        let tools = await mcp.client.listTools();
        let slowTool = tools.tools.find(tool => /slow_operation/.test(tool.name));
        expect(slowTool).toBeTruthy();

        let result = await mcp.client.callTool({
          name: slowTool!.name,
          arguments: { delayMs: 12_000 }
        });
        let text = (
          result as { content?: Array<{ type?: string; text?: string }> }
        ).content?.find(p => p.type === 'text')?.text;

        expect(text).toContain('Slow operation completed after 12000ms');
      } finally {
        await mcp.cleanup();
      }
    }
  );

  it(
    'enforces the tenant message processing timeout for long-running tool calls',
    { timeout: 120_000 },
    async () => {
      let ctx = await createMcpE2eContext(testDb, {
        remoteServerBaseUrl: lifecycle.getRemoteServerBaseUrl(),
        transportCase: defaultTransportCase
      });

      await testDb.tenant.update({
        where: { oid: ctx.session.tenantOid },
        data: {
          messageProcessingTimeoutMs: 1_000
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
        let slowTool = tools.tools.find(tool => /slow_operation/.test(tool.name));
        expect(slowTool).toBeTruthy();

        await expect(
          mcp.client.callTool({
            name: slowTool!.name,
            arguments: { delayMs: 3_000 }
          })
        ).rejects.toThrow(/tenant timeout|timed out|timeout/i);
      } finally {
        await mcp.cleanup();
      }
    }
  );

  it(
    'returns 202 Accepted with no body for streamable HTTP notifications',
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

        expect(mcp.transport).toBeInstanceOf(StreamableHTTPClientTransport);

        let response = await localFetch(ctx.proxyUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/json, text/event-stream',
            'Content-Type': 'application/json',
            'MCP-Session-ID': (mcp.transport as StreamableHTTPClientTransport).sessionId!
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized'
          })
        });

        expect(response.status).toBe(202);
        expect(await response.text()).toBe('');
      } finally {
        await mcp.cleanup();
      }
    }
  );

  it(
    'emits progress notifications only when _meta.progressToken is provided',
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

        expect(mcp.transport).toBeInstanceOf(StreamableHTTPClientTransport);

        let tools = await mcp.client.listTools();
        let slowTool = tools.tools.find(tool => /slow_operation/.test(tool.name));
        expect(slowTool).toBeTruthy();

        let sessionId = (mcp.transport as StreamableHTTPClientTransport).sessionId!;
        let progressToken = 'progress-token-123';

        let withProgressResponse = await localFetch(ctx.proxyUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/json, text/event-stream',
            'Content-Type': 'application/json',
            'MCP-Session-ID': sessionId
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'call-with-progress',
            method: 'tools/call',
            params: {
              name: slowTool!.name,
              arguments: { delayMs: 6_500 },
              _meta: { progressToken }
            }
          })
        });

        let withProgressMessages = await getStreamableHttpSseMessages(withProgressResponse);
        let progressMessages = withProgressMessages.filter(
          message => message.method === 'notifications/progress'
        );
        let finalMessage = withProgressMessages.find(message => message.id === 'call-with-progress');

        expect(progressMessages.length).toBeGreaterThan(0);
        expect(progressMessages.every(message => message.params?.progressToken === progressToken)).toBe(
          true
        );
        expect(finalMessage?.result?.content?.[0]?.text).toContain(
          'Slow operation completed after 6500ms'
        );

        let withoutProgressResponse = await localFetch(ctx.proxyUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/json, text/event-stream',
            'Content-Type': 'application/json',
            'MCP-Session-ID': sessionId
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'call-without-progress',
            method: 'tools/call',
            params: {
              name: slowTool!.name,
              arguments: { delayMs: 6_500 }
            }
          })
        });

        let withoutProgressMessages = await getStreamableHttpSseMessages(withoutProgressResponse);

        expect(
          withoutProgressMessages.some(message => message.method === 'notifications/progress')
        ).toBe(false);
        expect(
          withoutProgressMessages.find(message => message.id === 'call-without-progress')?.result
            ?.content?.[0]?.text
        ).toContain('Slow operation completed after 6500ms');
      } finally {
        await mcp.cleanup();
      }
    }
  );

  it(
    'upserts system agent clients without oauth registrations',
    { timeout: 120_000 },
    async () => {
      let ctx = await createMcpE2eContext(testDb, {
        remoteServerBaseUrl: lifecycle.getRemoteServerBaseUrl(),
        transportCase: defaultTransportCase
      });
      let foreignId = `system-client:${ctx.session.id}`;

      let mcp = createMcpTestClient({
        baseUrl: ctx.proxyUrl,
        transportType: defaultTransportCase.clientTransport,
        fetch: localFetch,
        headers: {
          'Metorial-Agent-Client': JSON.stringify({
            name: 'Metorial Explorer',
            type: 'system_client',
            foreignId
          })
        }
      });

      try {
        await mcp.connect();

        let agentClient = await testDb.agentClient.findFirst({
          where: { foreignId }
        });
        expect(agentClient).toBeTruthy();
        expect(agentClient?.name).toBe('Metorial Explorer');
        expect(agentClient?.type).toBe('system_client');

        let registrationCount = await testDb.agentClientRegistration.count({
          where: { agentClientOid: agentClient!.oid }
        });
        expect(registrationCount).toBe(0);
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
    'injects operationInfo into tool schemas and stores extracted tool call metadata',
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

        let operationSchema = (addTool!.inputSchema as any)?.properties?.operationInfo;
        expect(operationSchema.description).toContain('MUST be provided');

        let result = await mcp.client.callTool({
          name: addTool!.name,
          arguments: {
            a: 1,
            b: 2,
            operationInfo: {
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
          (toolCall.message.input as any)?.data?.params?.arguments?.operationInfo
        ).toBeUndefined();
      } finally {
        await mcp.cleanup();
      }
    }
  );
});
