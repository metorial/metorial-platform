import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';

type ServerFactory = () => McpServer;
type SseSession = {
  server: McpServer;
  transport: SSEServerTransport;
};
type StreamableSession = {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
};

const INTERNAL_SERVER_ERROR = 'Internal server error';
const SESSION_ID_REQUIRED = 'Session ID is required';

const firstString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

const getSessionId = (req: Request) => {
  return firstString(req.query.sessionId) ?? firstString(req.params.sessionId);
};

const getMcpSessionId = (req: Request) => {
  return firstString(req.headers['mcp-session-id']);
};

const isInitializeRequest = (req: Request) => {
  if (req.method !== 'POST') return false;
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return false;
  return (req.body as { method?: unknown }).method === 'initialize';
};

const sendJsonError = (res: Response, statusCode: number, message: string) => {
  if (!res.headersSent) {
    res.status(statusCode).json({ error: message });
  }
};

const closeWithLog = (label: string, closeFn: () => Promise<void>) => {
  // biome-ignore lint/complexity/noVoid: <>
  void closeFn().catch(err => {
    console.error(label, err);
  });
};

export async function setupTransports(
  app: Express,
  createServer: ServerFactory,
  basePath: string = ''
) {
  app.use(cors());
  app.use(express.json());

  const ssePath = `${basePath}/sse`;
  const sseMessagePath = `${basePath}/message`;
  const mcpPath = `${basePath}/mcp`;
  const sseSessions = new Map<string, SseSession>();
  const streamableSessions = new Map<string, StreamableSession>();

  const closeStreamableSession = (sessionId: string, reason: string) => {
    const session = streamableSessions.get(sessionId);
    if (!session) return;

    streamableSessions.delete(sessionId);
    closeWithLog(
      `Error closing streamable HTTP server for session ${sessionId} (${reason}):`,
      () => session.server.close()
    );
  };

  const createStreamableSession = async (): Promise<StreamableSession> => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: sessionId => {
        streamableSessions.set(sessionId, { server, transport });
        console.log(`Streamable HTTP session initialized at ${mcpPath}: ${sessionId}`);
      },
      onsessionclosed: sessionId => {
        console.log(`Streamable HTTP session closed at ${mcpPath}: ${sessionId}`);
        closeStreamableSession(sessionId, 'session closed');
      }
    });

    await server.connect(transport);

    transport.onclose = () => {
      let sessionId = transport.sessionId;
      if (!sessionId || !streamableSessions.has(sessionId)) return;
      closeStreamableSession(sessionId, 'transport closed');
    };

    return { server, transport };
  };

  app.get(ssePath, async (req: Request, res: Response) => {
    console.log(`SSE connection established at ${ssePath}`);

    // Each SSE client gets an isolated MCP server instance.
    const transport = new SSEServerTransport(sseMessagePath, res);
    const sessionId = transport.sessionId;
    const sseServer = createServer();

    sseSessions.set(sessionId, { transport, server: sseServer });

    try {
      await sseServer.connect(transport);
    } catch (error) {
      sseSessions.delete(sessionId);
      console.error(`Error establishing SSE session ${sessionId}:`, error);
      sendJsonError(res, 500, INTERNAL_SERVER_ERROR);
      return;
    }

    req.on('close', () => {
      console.log(`SSE connection closed at ${ssePath} for session ${sessionId}`);
      sseSessions.delete(sessionId);

      closeWithLog(`Error closing SSE server for session ${sessionId}:`, () =>
        sseServer.close()
      );
      closeWithLog(`Error closing SSE transport for session ${sessionId}:`, () =>
        transport.close()
      );
    });
  });

  const handleSseMessage = async (req: Request, res: Response) => {
    const sessionId = getSessionId(req);

    if (!sessionId) {
      sendJsonError(res, 400, SESSION_ID_REQUIRED);
      return;
    }

    const session = sseSessions.get(sessionId);
    if (!session) {
      sendJsonError(res, 404, `Session not found: ${sessionId}`);
      return;
    }

    try {
      await session.transport.handlePostMessage(req as any, res as any, req.body);
    } catch (error) {
      console.error(`Error handling SSE message for session ${sessionId}:`, error);
      sendJsonError(res, 500, INTERNAL_SERVER_ERROR);
    }
  };

  app.post(sseMessagePath, handleSseMessage);
  app.post(`${sseMessagePath}/:sessionId`, handleSseMessage);

  app.all(mcpPath, async (req: Request, res: Response) => {
    let sessionId = getMcpSessionId(req);
    console.log(
      `${req.method} request received at ${mcpPath}${sessionId ? ` (session ${sessionId})` : ''}`
    );
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    let session: StreamableSession;
    let createdSession = false;

    if (sessionId) {
      let existing = streamableSessions.get(sessionId);
      if (!existing) {
        sendJsonError(res, 404, `Session not found: ${sessionId}`);
        return;
      }
      session = existing;
    } else if (isInitializeRequest(req)) {
      session = await createStreamableSession();
      createdSession = true;
    } else {
      sendJsonError(res, 400, SESSION_ID_REQUIRED);
      return;
    }

    try {
      await session.transport.handleRequest(req as any, res as any, req.body);

      let initializedSessionId = session.transport.sessionId;
      if (initializedSessionId && !streamableSessions.has(initializedSessionId)) {
        streamableSessions.set(initializedSessionId, session);
      }

      console.log('Request handled successfully');
    } catch (error) {
      if (createdSession) {
        let initializedSessionId = session.transport.sessionId;
        if (initializedSessionId) {
          closeStreamableSession(initializedSessionId, 'request handling failure');
        } else {
          closeWithLog(
            'Error closing streamable HTTP server after failed initialize request:',
            () => session.server.close()
          );
        }
      }

      console.error('Error handling streamable HTTP request:', error);
      sendJsonError(res, 500, INTERNAL_SERVER_ERROR);
    }
  });
}
