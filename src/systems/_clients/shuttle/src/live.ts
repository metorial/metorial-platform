import { IsomorphicWs } from '@metorial/util-websocket';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ConnectionMessage } from '../../../service/src/mcp/utils/messenger';

export let createLiveConnectionClient = (opts: { endpoint: string }) => ({
  connect: (d: {
    tenantId: string;
    connectionId: string;
    onOpen?: () => void;
    onMessage?: (msg: ConnectionMessage) => void;
    onClose?: () => void;
  }) => {
    let ws = new IsomorphicWs(
      `${opts.endpoint}/${d.tenantId}/connection/${d.connectionId}/live`
    );

    ws.on('open', () => {
      d.onOpen?.();
    });

    ws.on('message', (data: string) => {
      let msg: any = JSON.parse(data);
      d.onMessage?.({
        type: msg.type,
        data: msg.data
      });
    });

    ws.on('close', () => {
      d.onClose?.();
    });

    return {
      sendMcpMessage: async (msg: JSONRPCMessage) => {
        await ws.send(
          JSON.stringify({
            type: 'mcp.message',
            data: msg
          })
        );
      },
      close: async () => {
        ws.close();
      }
    };
  }
});
