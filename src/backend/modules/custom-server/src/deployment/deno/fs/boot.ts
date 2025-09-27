export let bootTs = `import { ProgrammablePromise } from './promise.ts';
import { OutputInstrumentation } from './logs.ts';
import { getClient } from './server.ts';
import { discover } from './discover.ts';
import { JWTPayload, jwtVerify, SignJWT } from "npm:jose@5.9.6";
import path from 'node:path';

Deno.serve(async (req) => {
  let url = new URL(req.url);

  let entrypoint = Deno.env.get('CUSTOM_SERVER_ENTRYPOINT')!
  let expectedToken = Deno.env.get('METORIAL_AUTH_TOKEN_SECRET')!;
  let actualToken = req.headers.get('x-metorial-stellar-token')!;

  if (expectedToken !== actualToken) return new Response('Unauthorized', { status: 401 });

  if (url.pathname == '/health') {
    return new Response('OK');
  }

  if (url.pathname == '/discover') {
    let file = \`./app/\${entrypoint}\`
    console.log('Importing entrypoint file:', file);
    await import(file);

    let client = await getClient({
      client: {
        name: 'Metorial Auto Discover',
        version: '0.1.0'
      },
      capabilities: {},
      notificationListener: (notification) => {}
    });

    let res = await discover(client);

    return new Response(JSON.stringify(res), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (url.pathname == '/mcp') {
    if (req.headers.get('upgrade') != 'websocket') return new Response(null, { status: 426 });
    let { socket, response } = Deno.upgradeWebSocket(req);

    let socketReadyPromise = new ProgrammablePromise<any>();

    let outputInstrumentation = new OutputInstrumentation(async (lines) => {
      let socket = await socketReadyPromise.promise;
      socket.send(JSON.stringify([{ type: 'logs', lines }]));
    })

    socket.addEventListener('open', () => {
      socketReadyPromise.resolve(socket);
    });

    socket.addEventListener('message', async (event) => {
      let socket = await socketReadyPromise.promise;

      let msg = JSON.parse(event.data);
      for (let part of msg) {
        if (part.type == 'mcp.request') {
          try {
            let client = await getClient({
              client: part.mcp.client,
              // capabilities: part.mcp.capabilities ?? {},
              capabilities: {}, // Client's can't have capabilities for now
              notificationListener: (notification) => {
                socket.send(JSON.stringify([{ type: 'mcp.notification', notification }]));
              }
            });

            let resp = await client.request(
              part.request,
              z.any(),
              { timeout: part.opts.timeoutMs || 30000 }
            );

            socket.send(JSON.stringify([{ type: 'mcp.response', response: resp }]));
          } catch (error) {
            socket.send(JSON.stringify([{ type: 'error', error: String(error) }]));
          }
        }
      }
    });

    socket.addEventListener('close', () => {
      outputInstrumentation.drain();
    });

    (async () => {
      await import(\`./app/\${entrypoint}\`);
    })().catch(async (error) => {
      let socket = await socketReadyPromise.promise;
      socket.send(JSON.stringify([{ type: 'logs', lines: [{ type: 'error', line: 'Failed to start server:' + String(error) + '\\n' }] }]));
      socket.send(JSON.stringify([{ type: 'error', error: String(error) }]));
      socket.close();
    });

    return response;
  }
});
`;
