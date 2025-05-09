import { Emitter } from '@metorial/emitter';
import { InterconnectChannelClient } from '@metorial/interconnect-base';
import { ReconnectingWebSocketClient } from './websocket';

export class InterconnectChannelWsClient extends InterconnectChannelClient {
  #ws: ReconnectingWebSocketClient;
  #emitter = new Emitter<{
    ready: void;
    message: string;
    error: Error;
    close: void;
  }>();

  constructor(public readonly url: string) {
    super();

    this.#ws = new ReconnectingWebSocketClient(url, {
      onOpen: () => {
        this.#emitter.emit('ready');
      },
      onMessage: data => {
        if (typeof data.data != 'string') {
          console.error('Received non-string data:', data.data);
          return;
        }

        this.#emitter.emit('message', data.data);
      },
      onError: error => {
        this.#emitter.emit('error', error.error ?? new Error('Unknown error'));
      },
      onClose: () => {
        this.close();
      }
    });
  }

  async send(data: string) {
    await this.#ws.send(data);
  }

  onMessage(callback: (data: string) => void) {
    return this.#emitter.on('message', callback);
  }

  onError(callback: (error: Error) => void) {
    return this.#emitter.on('error', callback);
  }

  onReady(callback: () => void) {
    return this.#emitter.on('ready', callback);
  }

  onClose(callback: () => void) {
    return this.#emitter.on('close', callback);
  }

  #closed = false;
  async close() {
    if (this.#closed) return;
    this.#closed = true;

    this.#emitter.emit('close');
    this.#emitter.clear();

    try {
      await this.#ws.close();
    } catch (error) {}
  }
}
