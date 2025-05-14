import { messageSchema, MICMessage } from './schema';
import { MICSession } from './session';

export class MICOverWebsocket {
  #session: MICSession;

  constructor(private info: { sessionId: string; connectionId: string }) {
    this.#session = new MICSession(this.info);
  }

  async send(message: MICMessage) {
    let valRes = messageSchema.validate(message);
    if (!valRes.success) {
      return await this.#session.send(
        {
          metorialInterconnect: '1.0',
          type: 'response/error',
          id: (message as any).id,
          error: {
            code: -32603,
            message: 'Invalid message',
            data: { errors: valRes.errors }
          }
        },
        { isSelf: true }
      );
    }

    return await this.#session.send(valRes.value);
  }

  onClose(callback: () => void, opts?: { once?: boolean }) {
    return this.#session.onClose(callback, opts);
  }

  onMessage(callback: (data: MICMessage) => void, opts?: { once?: boolean }) {
    return this.#session.onMessage(data => callback(data), opts);
  }

  close() {
    return this.#session.close();
  }
}
