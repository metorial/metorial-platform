import { debug } from '@metorial/debug';
import { Emitter } from '@metorial/emitter';
import { messageSchema, MICMessage, MICTransceiver } from '@metorial/interconnect';
import type { ServerWebSocket } from 'bun';
import type { WSContext } from 'hono/ws';

export interface MICTransceiverWebsocketServerEvents {
  message: { payload: any };
  close: void;
}

export class MICTransceiverWebsocketServer extends MICTransceiver {
  #emitter = new Emitter<MICTransceiverWebsocketServerEvents>();

  constructor(
    info: { sessionId: string; connectionId: string },
    private ws: WSContext<ServerWebSocket<undefined>>
  ) {
    super(info);
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

    this.#emitter.clear();

    // Only close the connection if it's open or connecting.
    // 0 = CONNECTING
    // 1 = OPEN
    // 2 = CLOSING
    // 3 = CLOSED
    try {
      if (this.ws.readyState <= 1) this.ws.close();
    } catch (e) {}

    // @ts-ignore
    this.ws = null;
  }

  registerMessage(data: string) {
    let json: any;

    try {
      json = JSON.parse(data);
    } catch (e) {
      debug.log('Failed to parse message', e);
      return;
    }

    let valRes = messageSchema.validate(json);
    if (!valRes.success) {
      debug.log('Invalid message', valRes.errors);
      return;
    }

    this.#emitter.emit('message', {
      payload: valRes.value
    });
  }

  registerClose() {
    this.#emitter.clear();
    this.#emitter.emit('close', undefined);
  }
}
