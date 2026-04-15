import { createHono } from '@lowerdeck/hono';
import { upgradeWebSocket, websocket } from 'hono/bun';
import type { WSContext } from 'hono/ws';
import { AsyncConnection } from '../../mcp/connection/async';
import { ClientConnection } from '../../mcp/connection/client';
import { serverConnectionPresenter } from '../../presenters';
import { serverConnectionService, tenantService } from '../../services';

export { websocket };

let send = (ws: WSContext<any>, type: string, data: any) =>
  ws.send(JSON.stringify({ type, data }));

export let connectionApp = createHono().get(
  '/:tenantId/connection/:connectionId/live',
  upgradeWebSocket(async c => {
    let tenantId = c.req.param('tenantId');
    let serverConnectionId = c.req.param('connectionId');

    if (!tenantId || !serverConnectionId) {
      throw new Error('Missing connection route params');
    }

    let tenant = await tenantService.getTenantById({ id: tenantId });
    let connection = await serverConnectionService.getServerConnectionById({
      tenant,
      serverConnectionId
    });

    let mcp = new AsyncConnection();

    return {
      onOpen: async (_, ws) => {
        send(ws, 'connected', {});
        send(ws, 'connection', { connection: serverConnectionPresenter(connection) });

        mcp.onMessage(async msg => {
          send(ws, msg.type, msg.data);

          if (msg.type == 'close') {
            setTimeout(() => ws.close(), 100);
          }
        });

        mcp.setAdapter(await ClientConnection.create(connection));
      },

      onMessage: async (msg, ws) => {
        let parsed = JSON.parse(msg.data.toString());

        if (!parsed.type) {
          await mcp.sendMcpMessage(parsed);
        }

        if (parsed.type == 'mcp.message') {
          await mcp.sendMcpMessage(parsed.data);
        }
      },

      onClose: async (_, ws) => {
        await mcp.terminate();
      }
    };
  })
);
