import { ServerDeployment, ServerSession, ServerVariant, Session } from '@metorial/db';
import { debug } from '@metorial/debug';
import { JSONRPCMessage, JSONRPCMessageSchema, McpError } from '@metorial/mcp-utils';
import { SessionConnection } from '@metorial/module-session';

export class McpServerConnection {
  #sendAndReceiveConnection: SessionConnection | null = null;
  #sendOnlyConnection: SessionConnection | null = null;

  constructor(
    private session: Session,
    private serverSession: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
      };
    }
  ) {}

  ensureReceiveConnection() {
    let connection =
      this.#sendAndReceiveConnection ??
      new SessionConnection(this.serverSession, {
        mode: 'send-and-receive',
        receiveControlMessages: true
      });
    this.#sendAndReceiveConnection = connection;

    let close = async () => {
      debug.log('MCP connection closed');
      connection.close();
    };

    let onMessage = (cb: (msg: JSONRPCMessage) => Promise<any>) => {
      connection.onMessage(
        {
          type: ['error', 'notification', 'response', 'request']
        },
        async msg => {
          debug.log('MCP message - out', {
            ...msg,
            result: undefined,
            params: undefined
          });
          await cb(msg);
        }
      );
    };

    return {
      connection,
      onMessage,
      close
    };
  }

  async handleMessage(data: any) {
    if (typeof data == 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        throw new McpError('parse_error');
      }
    }

    let res = tryParseMessages(data);
    for (let item of res) {
      if (item.status == 'error') throw item.error;
    }

    let connection =
      this.#sendAndReceiveConnection ??
      this.#sendOnlyConnection ??
      new SessionConnection(this.serverSession, {
        mode: 'send-only',
        receiveControlMessages: true
      });
    this.#sendOnlyConnection = connection;

    await connection.sendMessage(res.map(item => item.message!));
  }
}

export let tryParseMessages = (data: any) => {
  let dataArray = Array.isArray(data) ? data : [data];

  return dataArray.map(item => {
    let valRes = JSONRPCMessageSchema.safeParse(item);
    if (!valRes.success) {
      return {
        status: 'error' as const,
        error: new McpError('invalid_request', {
          message: 'Invalid message format',
          details: valRes.error.flatten().fieldErrors
        })
      };
    }

    return {
      status: 'ok' as const,
      message: valRes.data
    };
  });
};
