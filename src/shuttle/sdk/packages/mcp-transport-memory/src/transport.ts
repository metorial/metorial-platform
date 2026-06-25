import { type Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export interface InMemoryTransportPair {
  server: InMemoryServerTransport;
  client: InMemoryClientTransport;
}

export class InMemoryServerTransport implements Transport {
  private _started = false;
  private _closed = false;
  private _clientTransport?: InMemoryClientTransport;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  _connect(clientTransport: InMemoryClientTransport): void {
    this._clientTransport = clientTransport;
  }

  _receiveMessage(message: JSONRPCMessage): void {
    if (this._closed) return;

    setTimeout(() => {
      if (!this._closed) this.onmessage?.(message);
    }, 0);
  }

  _handleClientClose(): void {
    if (!this._closed) {
      this._closed = true;
      this.onclose?.();
    }
  }

  async start(): Promise<void> {
    if (this._started) {
      throw new Error('InMemoryServerTransport already started!');
    }
    if (this._closed) {
      throw new Error('InMemoryServerTransport is closed and cannot be restarted!');
    }

    this._started = true;
  }

  async close(): Promise<void> {
    if (this._closed) return;

    this._closed = true;

    // Notify the client transport that we're closing
    if (this._clientTransport) {
      this._clientTransport._handleServerClose();
    }

    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this._closed) {
      throw new Error('Transport is closed');
    }
    if (!this._clientTransport) {
      throw new Error('Not connected to client transport');
    }

    this._clientTransport._receiveMessage(message);
  }
}

export class InMemoryClientTransport implements Transport {
  private _started = false;
  private _closed = false;
  private _serverTransport?: InMemoryServerTransport;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  _connect(serverTransport: InMemoryServerTransport): void {
    this._serverTransport = serverTransport;
  }

  _receiveMessage(message: JSONRPCMessage): void {
    if (this._closed) return;

    setTimeout(() => {
      if (!this._closed) this.onmessage?.(message);
    }, 0);
  }

  _handleServerClose(): void {
    if (!this._closed) {
      this._closed = true;
      this.onclose?.();
    }
  }

  async start(): Promise<void> {
    if (this._started) {
      throw new Error('InMemoryClientTransport already started!');
    }
    if (this._closed) {
      throw new Error('InMemoryClientTransport is closed and cannot be restarted!');
    }

    this._started = true;
  }

  async close(): Promise<void> {
    if (this._closed) return;

    this._closed = true;

    if (this._serverTransport) {
      this._serverTransport._handleClientClose();
    }

    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this._closed) {
      throw new Error('Transport is closed');
    }
    if (!this._serverTransport) {
      throw new Error('Not connected to server transport');
    }

    this._serverTransport._receiveMessage(message);
  }
}

export let createInMemoryTransport = (): InMemoryTransportPair => {
  let serverTransport = new InMemoryServerTransport();
  let clientTransport = new InMemoryClientTransport();

  serverTransport._connect(clientTransport);
  clientTransport._connect(serverTransport);

  return {
    server: serverTransport,
    client: clientTransport
  };
};
