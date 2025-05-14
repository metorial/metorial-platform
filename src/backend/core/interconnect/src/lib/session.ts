import { MICBus } from './bus';
import { MICMessage } from './schema';

export class MICSession {
  #bus: MICBus;

  constructor(private info: { sessionId: string; connectionId: string }) {
    this.#bus = new MICBus(this.info);
  }

  send(message: MICMessage, opts?: { isSelf?: boolean }) {
    return this.#bus.sendMessage(message, opts);
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
