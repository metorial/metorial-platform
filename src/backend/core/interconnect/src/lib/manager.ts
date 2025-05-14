import { generatePlainId } from '@metorial/id';
import { MICResponseErrorMessage } from './schema';
import { MICSession } from './session';

export class MICError extends Error {
  constructor(private error: MICResponseErrorMessage) {
    super(error.error.message);
    this.name = 'MICError';
  }

  get code() {
    return this.error.error.code;
  }

  get data() {
    return this.error.error.data;
  }
}

export class MICManager {
  #session: MICSession;
  #managerId: string;
  #messageIndex: number = 0;

  constructor(private info: { sessionId: string; connectionId: string }) {
    this.#session = new MICSession(this.info);
    this.#managerId = generatePlainId(10);
  }

  private getMessageId() {
    this.#messageIndex++;
    if (this.#messageIndex > 1000000) {
      this.#messageIndex = 0;
      this.#managerId = generatePlainId(10);
    }

    return `${this.#managerId}-${this.#messageIndex}`;
  }

  async request(method: string, params: any) {
    let id = this.getMessageId();

    await this.#session.send({
      metorialInterconnect: '1.0',
      type: 'request',
      id,
      method,
      params
    });

    return new Promise((resolve, reject) => {
      this.#session.onMessage(data => {
        if (data.type == 'response' && data.id == id) {
          resolve(data.result);
        }

        if (data.type == 'response/error' && data.id == id) {
          reject(new MICError(data));
        }
      });
    });
  }

  async notify(method: string, params: any) {
    await this.#session.send({
      metorialInterconnect: '1.0',
      type: 'notification',
      method,
      params
    });
  }

  onClose(callback: () => void, opts?: { once?: boolean }) {
    return this.#session.onClose(callback, opts);
  }

  onNotification(method: string, handler: (params: any) => any) {
    return this.#session.onMessage(data => {
      if (data.type == 'notification' && data.method == method) {
        handler(data.params);
      }
    });
  }

  onRequest(method: string, handler: (params: any) => Promise<any>) {
    return this.#session.onMessage(async data => {
      if (data.type == 'request' && data.method == method) {
        let res = await handler(data.params);

        await this.#session.send({
          metorialInterconnect: '1.0',
          type: 'response',
          id: data.id,
          result: res
        });
      }
    });
  }

  close() {
    return this.#session.close();
  }
}
