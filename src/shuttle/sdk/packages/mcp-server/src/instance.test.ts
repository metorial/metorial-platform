import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import z from 'zod';
import { serverAdapter } from './adapter';
import { McpServerInstance } from './instance';

let createTestInstance = () => {
  let server = new McpServer(
    {
      name: 'warm-lambda-test',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.registerTool(
    'echo',
    {
      inputSchema: {
        value: z.string()
      }
    },
    async ({ value }) => ({
      content: [{ type: 'text', text: value }]
    })
  );

  return McpServerInstance.create({ server });
};

let client = {
  client: {
    name: 'Warm Lambda Test',
    version: '1.0.0'
  },
  capabilities: {}
};

describe('McpServerInstance sessions', () => {
  it('discovers repeatedly on the same warm instance', async () => {
    let instance = createTestInstance();

    let first = await instance.discover();
    let second = await instance.discover();

    expect(first.server.info?.name).toBe('warm-lambda-test');
    expect(second.server.info?.name).toBe('warm-lambda-test');
  });

  it('handles tools/list after deploy discovery on the same warm instance', async () => {
    let instance = createTestInstance();

    await instance.discover();
    let result = await instance.handleMcpMessages({
      config: {},
      authConfig: {},
      client,
      message: [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        }
      ]
    });

    expect(result.error).toBeNull();
    expect(result.messages).toEqual([
      expect.objectContaining({
        id: 1,
        result: expect.objectContaining({
          tools: [expect.objectContaining({ name: 'echo' })]
        })
      })
    ]);
  });

  it('releases the transport after an MCP request error', async () => {
    let instance = createTestInstance();

    let result = await instance.handleMcpMessages({
      config: {},
      authConfig: {},
      client,
      message: [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'test/missing',
          params: {}
        }
      ]
    });

    expect(result.error).toBeInstanceOf(Error);
    await expect(instance.discover()).resolves.toEqual(
      expect.objectContaining({
        server: expect.objectContaining({
          info: expect.objectContaining({ name: 'warm-lambda-test' })
        })
      })
    );
  });

  it('processes a batched adapter request without overlapping sessions', async () => {
    let instance = createTestInstance();

    let results = await serverAdapter(instance, [
      { type: 'metorial-mcp.discover' },
      { type: 'metorial-mcp.discover' }
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(
      expect.objectContaining({
        server: expect.objectContaining({
          info: expect.objectContaining({ name: 'warm-lambda-test' })
        })
      })
    );
    expect(results[1]).toEqual(results[0]);
  });
});
