import { MICMessage, MICTransceiver } from '@metorial/interconnect';
import { MICBus } from './bus';

export class MICTransceiverRedis extends MICTransceiver {
  #bus: MICBus;

  constructor(info: { sessionId: string; connectionId: string }) {
    super(info);

    this.#bus = new MICBus(this.info);
  }

  send(message: MICMessage) {
    return this.#bus.sendMessage(message);
  }

  onMessage(callback: (data: MICMessage) => void, opts?: { once?: boolean }) {
    return this.#bus.onMessage(data => callback(data), opts);
  }

  onClose(callback: () => void, opts?: { once?: boolean }) {
    return this.#bus.onClose(() => callback(), opts);
  }

  close() {
    return this.#bus.close();
  }
}
