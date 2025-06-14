import { ServerRun } from '@metorial/db';
import { debug } from '@metorial/debug';
import { Emitter } from '@metorial/emitter';
import {
  JSONRPCMessageSchema,
  jsonRpcPingResponse,
  MCP_IDS,
  type JSONRPCMessage,
  type JSONRPCRequest,
  type JSONRPCResponse
} from '@metorial/mcp-utils';
import { EventSource } from 'eventsource';
import { BrokerRunnerImplementation, BrokerRunnerImplementationEvents } from './base';

export class BrokerRunnerImplementationExternal extends BrokerRunnerImplementation {
  protected constructor(
    private eventSource: EventSource,
    private endpoint: string,
    emitter: Emitter<BrokerRunnerImplementationEvents>
  ) {
    super(emitter);

    eventSource.addEventListener('message', event => {
      this.lastMessageAt = Date.now();

      try {
        let parsed = JSONRPCMessageSchema.safeParse(JSON.parse(event.data));
        if (parsed.success) {
          let payload = parsed.data;

          let hasMethod = 'method' in payload;
          let hasId = 'id' in payload;

          if (hasMethod && hasId && (payload as JSONRPCRequest).method == 'ping') {
            // Handle ping request
            this.sendMessage(jsonRpcPingResponse(payload as any));
          } else if (
            hasId &&
            String((payload as JSONRPCResponse).id).startsWith(MCP_IDS.PING)
          ) {
            emitter.emit('ping');
          } else {
            emitter.emit('message', payload);
          }
        }
      } catch (error) {
        debug.error('Invalid message format', error);
        // emitter.emit('error', new Error('Invalid message format'));
      }
    });
  }

  static async create(
    run: ServerRun,
    data: {
      url: string;
      transport: 'mcp/sse';
      headers?: Record<string, string>;
      query?: Record<string, string>;
    }
  ) {
    let emitter = BrokerRunnerImplementation.createEmitter();

    let url = new URL(data.url);
    if (data.query) {
      for (let [key, value] of Object.entries(data.query)) {
        url.searchParams.append(key, value);
      }
    }

    return new Promise<BrokerRunnerImplementationExternal>((resolve, reject) => {
      let eventSource = new EventSource(url, {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            headers: {
              ...init?.headers,
              ...data.headers,

              'x-metorial-server-run-id': run.id,
              'user-agent':
                process.env.METORIAL_SOURCE == 'enterprise'
                  ? 'Metorial (https://metorial.com, hey@metorial.com)'
                  : 'Metorial OPEN SOURCE (https://github.com/metorial)'
            }
          })
      });

      let opened = { current: false };

      eventSource.addEventListener('error', error => {
        debug.error('Runner MCP connection error', error);

        if (opened.current) {
          emitter.emit('close');
          emitter.clear();
        } else {
          debug.error('Broker connection error', error);

          // TODO: add support for auth
          reject(new Error('Connection error'));
        }
      });

      eventSource.addEventListener('endpoint', event => {
        opened.current = true;

        try {
          let endpointUrl = new URL(event.data, url);

          debug.error('Runner MCP connection opened', endpointUrl.toString());

          resolve(
            new BrokerRunnerImplementationExternal(
              eventSource,
              endpointUrl.toString(),
              emitter
            )
          );
        } catch (error) {
          reject(error);
          emitter.emit('error', new Error('Invalid endpoint URL'));

          if (eventSource.readyState != eventSource.CLOSED) eventSource.close();
        }
      });

      eventSource.addEventListener('close', () => {
        debug.error('Runner MCP connection closed');

        emitter.emit('close');
        emitter.clear();
      });
    });
  }

  protected async sendMessageImpl(message: JSONRPCMessage) {
    let res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!res.ok) throw new Error('Failed to send message');
  }

  protected async closeImpl() {
    try {
      this.eventSource.close();
    } catch (error) {}
  }
}
