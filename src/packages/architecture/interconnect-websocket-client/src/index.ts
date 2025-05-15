import { debug } from '@metorial/debug';
import { Emitter } from '@metorial/emitter';
import { MICMessage, MICTransceiver } from '@metorial/interconnect';
import { ReconnectingWebSocketClient } from '@metorial/websocket';

export interface MICTransceiverWebsocketClientEvents {
  message: { payload: any };
  close: void;
}

export class MICTransceiverWebsocketClient extends MICTransceiver {
  #emitter = new Emitter<MICTransceiverWebsocketClientEvents>();

  constructor(
    info: { sessionId: string; connectionId: string },
    private ws: WebSocket | ReconnectingWebSocketClient
  ) {
    super(info);

    this.ws.addEventListener('message', (event: MessageEvent) => {
      this.registerMessage(event.data);
    });

    this.ws.addEventListener('close', () => {
      this.registerClose();
    });
  }

  async send(message: MICMessage) {
    await this.ws.send(JSON.stringify(message));
  }

  async onMessage(callback: (data: MICMessage) => void, opts?: { once?: boolean }) {
    let unsub = this.#emitter.on('message', data => {
      callback(data.payload);
      if (opts?.once) unsub();
    });
  }

  async onClose(callback: () => void, opts?: { once?: boolean }) {
    let unsub = this.#emitter.on('close', () => {
      callback();
      if (opts?.once) unsub();
    });
  }

  #isClosed = false;
  async close() {
    if (this.#isClosed) return;
    this.#isClosed = true;

    this.registerClose();

    this.#emitter.clear();

    // Only close the connection if it's open or connecting.
    // 0 = CONNECTING
    // 1 = OPEN
    // 2 = CLOSING
    // 3 = CLOSED
    try {
      if (this.ws.readyState <= 1) this.ws.close();
    } catch (e) {}
  }

  private registerMessage(data: string) {
    if (data == 'ping') {
      this.ws.send('ping');
      return;
    }

    try {
      this.#emitter.emit('message', { payload: JSON.parse(data) });
    } catch (e) {
      debug.log('Failed to parse message', e);
    }
  }

  private registerClose() {
    this.#emitter.clear();
    this.#emitter.emit('close', undefined);
  }
}
