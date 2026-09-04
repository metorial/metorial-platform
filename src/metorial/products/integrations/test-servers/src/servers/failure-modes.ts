import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Express, Request, Response } from 'express';
import z from 'zod';

/**
 * Servers that reproduce the failure modes Subspace has to survive: a server
 * that never answers, one that rejects every request, and one whose tool list
 * changes between connections.
 */

let connectionCount = 0;

export function resetChangingServerConnectionCount() {
  connectionCount = 0;
}

export function createChangingToolsServer(): McpServer {
  let connectionIndex = ++connectionCount;

  const mcpServer = new McpServer(
    { name: 'test-changing-tools', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  mcpServer.registerTool(
    'stable_tool',
    {
      description: 'A tool that is present on every connection',
      inputSchema: { value: z.string().optional().describe('Any value') }
    },
    async ({ value }) => ({
      content: [{ type: 'text', text: `stable_tool: ${value ?? ''}` }]
    })
  );

  mcpServer.registerTool(
    `connection_${connectionIndex}_tool`,
    {
      description: `A tool that only exists on connection ${connectionIndex}`,
      inputSchema: {}
    },
    async () => ({
      content: [{ type: 'text', text: `connection ${connectionIndex}` }]
    })
  );

  return mcpServer;
}

let neverRespond = (_req: Request, res: Response) => {
  res.on('close', () => {});
};

let alwaysUnauthorized = (_req: Request, res: Response) => {
  res.status(401).json({ error: 'unauthorized' });
};

export function mountFailureModeRoutes(app: Express) {
  app.all('/unresponsive/mcp', neverRespond);
  app.get('/unresponsive/sse', neverRespond);
  app.post('/unresponsive/message', neverRespond);

  app.all('/unauthorized/mcp', alwaysUnauthorized);
  app.get('/unauthorized/sse', alwaysUnauthorized);
  app.post('/unauthorized/message', alwaysUnauthorized);
}
