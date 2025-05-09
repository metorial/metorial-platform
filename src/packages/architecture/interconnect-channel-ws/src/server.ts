import { Emitter } from '@metorial/emitter';
import {
  InterconnectChannelClient,
  InterconnectChannelServer
} from '@metorial/interconnect-base';

// Bun.serve({
//   fetch(req) {},
//   websocket: {
//     message(ws, message) {
//       ws.
//     }
//   }
// })

export class InterconnectChannelWsServerConnectionClient extends InterconnectChannelClient {
  public _emitter = new Emitter<{
    message: string;
    error: Error;
    ready: void;
    close: void;
  }>();

  constructor(private ws: Bun.ServerWebSocket<any>) {
    super();
  }

  async send(data: string) {
    await this.ws.send(data);
  }

  onMessage(callback: (data: string) => void) {
    return this._emitter.on('message', callback);
  }

  onError(callback: (error: Error) => void) {
    return this._emitter.on('error', callback);
  }

  onReady(callback: () => void) {
    return this._emitter.on('ready', callback);
  }

  onClose(callback: () => void) {
    return this._emitter.on('close', callback);
  }

  async close() {
    this._emitter.clear();

    try {
      await this.ws.close();
    } catch (error) {}
  }
}

export class InterconnectChannelWsServer extends InterconnectChannelServer {
  #openConnections = new WeakMap<
    Bun.ServerWebSocket<any>,
    {
      ws: Bun.ServerWebSocket<any>;
      client: InterconnectChannelWsServerConnectionClient;
    }
  >();
  private callback: (client: InterconnectChannelClient) => any = () => {
    throw new Error('No callback registered');
  };

  handleConnection<T>(callback: (client: InterconnectChannelClient) => T) {
    this.callback = callback;
  }

  registerOpen(ws: Bun.ServerWebSocket<any>) {
    let client = new InterconnectChannelWsServerConnectionClient(ws);

    this.#openConnections.set(ws, {
      ws,
      client
    });

    this.callback(client);
  }

  registerMessage(ws: Bun.ServerWebSocket<any>, message: string | Buffer<ArrayBufferLike>) {
    let connection = this.#openConnections.get(ws);
    if (!connection) throw new Error('Client not found');
    if (typeof message != 'string') return;

    connection.client._emitter.emit('message', message);
  }

  registerError(ws: Bun.ServerWebSocket<any>, error: Error) {
    let connection = this.#openConnections.get(ws);
    if (!connection) throw new Error('Client not found');

    connection.client._emitter.emit('error', error);
  }

  registerClose(ws: Bun.ServerWebSocket<any>) {
    let connection = this.#openConnections.get(ws);
    if (!connection) return; // If the connection is not found, it means it was already closed

    connection.client._emitter.emit('close');
    this.#openConnections.delete(ws);
  }
}
