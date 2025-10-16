export let bootTs = `import { ProgrammablePromise } from './promise.ts';
import { OutputInstrumentation } from './logs.ts';
import { getClient } from './server.ts';
import { discover } from './discover.ts';
import { oauth } from "./oauth.ts";
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { JWTPayload, jwtVerify, SignJWT } from "npm:jose@5.9.6";
import path from 'node:path';
import { z } from "npm:zod";

import './config.ts';

let json = (data: any, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

let handler = async (req: Request) => {
  let url = new URL(req.url);

  let entrypoint = Deno.env.get('CUSTOM_SERVER_ENTRYPOINT')!
  let expectedToken = Deno.env.get('METORIAL_AUTH_TOKEN_SECRET')!;

  let actualToken = req.headers.get('metorial-stellar-token')!;

  if (expectedToken !== actualToken) return new Response('Unauthorized', { status: 401 });

  if (url.pathname == '/health') {
    return new Response('OK');
  }

  let dryImport = async () => {
    globalThis.__metorial_setArgs__({});

    let file = \`./app/\${entrypoint}\`
    console.log('Importing entrypoint file:', file);
    await import(file);
  }

  if (url.pathname == '/discover' && req.method === 'GET') {
    await dryImport();

    let client = await getClient({}, {
      client: {
        name: 'Metorial Auto Discover',
        version: '0.1.0'
      },
      capabilities: {},
      notificationListener: (notification) => {}
    });

    let res = await discover(client);

    return json(res);
  }

  if (url.pathname === '/oauth' && req.method === 'GET') {
    await dryImport();

    let oauthResult = await oauth.get();
    return json({ enabled: !!oauthResult, hasForm: !!oauthResult?.getAuthForm });
  }

  if (url.pathname === '/oauth/authorization-url' && req.method === 'POST') {
    await dryImport();

    let body = await req.json();
    let oauthResult = await oauth.get();
    if (!oauthResult) return json({ error: 'OAuth not configured' }, 400);

    try {
      let authUrlResRaw = await oauthResult.getAuthorizationUrl(body.input || {});

      let authUrlRes = typeof authUrlResRaw == 'string' ? {
        authorizationUrl: authUrlResRaw
      } : authUrlResRaw;

      return json({ ...authUrlRes, success: true });
    } catch (error: any) {
      return json({ error: error?.message || 'Failed to get authorization URL' }, 400);
    }
  }

  if (url.pathname === '/oauth/authorization-form' && req.method === 'POST') {
    await dryImport();

    let body = await req.json();
    let oauthResult = await oauth.get();
    if (!oauthResult) return json({ error: 'OAuth not configured' }, 400);

    try {
      let authForm = await oauthResult.getAuthForm(body.input || {});
      return json({ success: true, authForm });
    } catch (error: any) {
      return json({ error: error?.message || 'Failed to get authorization form' }, 400);
    }
  }

  if (url.pathname === '/oauth/refresh' && req.method === 'POST') {
    await dryImport();

    let body = await req.json();
    let oauthResult = await oauth.get();
    if (!oauthResult) return json({ error: 'OAuth not configured' }, 400);

    if (!oauthResult.refreshAccessToken) {
      return json({ error: 'OAuth provider does not support refreshing access tokens' }, 400);
    }

    try {
      let authForm = await oauthResult.refreshAccessToken(body.input || {});
      return json({ success: true, authForm });
    } catch (error: any) {
      return json({ error: error?.message || 'Failed to get refresh access token' }, 400);
    }
  }

  if (url.pathname === '/oauth/callback' && req.method === 'POST') {
    await dryImport();

    let body = await req.json();
    let oauthResult = await oauth.get();
    if (!oauthResult) return json({ error: 'OAuth not configured' }, 400);

    try {
      let authData = await oauthResult.handleCallback(body.input || {});
      return json({ success: true, authData });
    } catch (error: any) {
      return json({ error: error?.message || 'Failed to get authorization form' }, 400);
    }
  }

  if (url.pathname == '/mcp') {
    if (req.headers.get('upgrade') != 'websocket') return new Response(null, { status: 426 });
    let { socket, response } = Deno.upgradeWebSocket(req);

    let clientInfoRaw = req.headers.get('metorial-stellar-client')!;
    let clientInfo = JSON.parse(clientInfoRaw || '{}');
    let argsRaw = req.headers.get('metorial-stellar-arguments')!;
    let args = JSON.parse(argsRaw || '{}');
    globalThis.__metorial_setArgs__(args);

    let socketReadyPromise = new ProgrammablePromise<any>();

    let outputInstrumentation = new OutputInstrumentation(async (lines) => {
      let socket = await socketReadyPromise.promise;
      socket.send(JSON.stringify({ type: 'logs', lines }));
    })

    socket.addEventListener('open', () => {
      socketReadyPromise.resolve(socket);
    });

    socket.addEventListener('message', async (event) => {
      let socket = await socketReadyPromise.promise;

      let msg = JSON.parse(event.data);
      if (msg.type == 'mcp.message') {
        try {
          let client = await getClient(args, {
            client: clientInfo.clientInfo ?? { name: 'Unknown', version: '0.0.0' },
            // capabilities: clientInfo.capabilities || {},
            capabilities: {}, // Client's can't have capabilities for now
            notificationListener: (notification) => {
              socket.send(JSON.stringify({ type: 'mcp.message', message: JSON.stringify(notification) }));
            }
          });

          let mcpMessage = JSON.parse(msg.message);

          if ('id' in mcpMessage) {
            try {
              let resp = await client.request(
                mcpMessage,
                z.any(),
                { timeout: msg.opts.timeoutMs || 30000 }
              );

              socket.send(JSON.stringify({ 
                type: 'mcp.message', 
                message: JSON.stringify({
                  jsonrpc: '2.0',
                  id: mcpMessage.id,
                  result: resp
                }) 
              }));
            } catch (error) {
              if (error instanceof McpError) {
                socket.send(JSON.stringify({ 
                  type: 'mcp.message', 
                  message: JSON.stringify({
                    jsonrpc: '2.0',
                    id: mcpMessage.id,
                    error: {
                      code: error.code,
                      message: error.message,
                      data: error.data
                    }
                  }) 
                }));
              } 
            }
          } else {
            await client.notification(mcpMessage);
          }
        } catch (error) {
          socket.send(JSON.stringify({ type: 'error', error: { code: 'execution_error', message: String(error) } }));
        }
      } else {
        console.warn('Unknown message type:', msg.type);  
      }
    });

    socket.addEventListener('close', () => {
      outputInstrumentation.drain();
    });

    (async () => {
      console.log('[Metorial Runtime]: Starting MCP server');
      await import(\`./app/\${entrypoint}\`);
      console.log('[Metorial Runtime]: MCP server started');
    })().catch(async (error) => {
      let socket = await socketReadyPromise.promise;
      socket.send(JSON.stringify({ type: 'logs', lines: [{ type: 'error', lines: ['Failed to start server:' + String(error) + '\\n'] }] }));
      socket.send(JSON.stringify({ type: 'error', error: { code: 'execution_error', message: String(error) } }));
      socket.close();
    });

    return response;
  }

  return new Response('Not Found', { status: 404 });
}

let portEnv = Deno.env.get('PORT');
if (!portEnv) {
  Deno.serve(handler);
} else {
  let port = parseInt(portEnv);
  Deno.serve({ port }, handler);
}
`;
