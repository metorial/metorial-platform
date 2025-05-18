import { isServiceError, ServiceError, timeoutError, validationError } from '@metorial/error';
import { generatePlainId } from '@metorial/id';
import { getSentry } from '@metorial/sentry';
import { ValidationType } from '@metorial/validation';
import { MICTransceiver } from './base';

const DEFAULT_TIMEOUT = 10000;

let sentry = getSentry();

export class MICSessionManger {
  #managerId: string;
  #messageIndex: number = 0;

  constructor(private transceiver: MICTransceiver) {
    this.#managerId = generatePlainId(10);
  }

  get info() {
    return this.transceiver.info;
  }

  protected getMessageId() {
    this.#messageIndex++;
    if (this.#messageIndex > 1000000) {
      this.#messageIndex = 0;
      this.#managerId = generatePlainId(10);
    }

    return `${this.#managerId}-${this.#messageIndex}`;
  }

  async request<T = unknown>(
    method: string,
    params: any,
    schema?: ValidationType<T>,
    opts?: {
      timeout?: number;
    }
  ) {
    let id = this.getMessageId();

    await this.transceiver.send({
      metorialInterconnect: '1.0',
      type: 'request',
      id,
      method,
      params
    });

    return new Promise<T>((resolve, reject) => {
      this.transceiver.onMessage(data => {
        let timedOutRef = { current: false };
        let timeout = setTimeout(() => {
          timedOutRef.current = true;
          reject(
            new ServiceError(
              timeoutError({
                message: 'Request timed out'
              })
            )
          );
        }, opts?.timeout || DEFAULT_TIMEOUT);

        if (!timedOutRef.current && data.type == 'response' && data.id == id) {
          clearTimeout(timeout);

          if (schema) {
            let valRes = schema.validate(data.result);
            if (!valRes.success)
              throw new ServiceError(
                validationError({ errors: valRes.errors, entity: 'response' })
              );

            data.result = valRes.value;
          }

          resolve(data.result as T);
        }

        if (!timedOutRef.current && data.type == 'response/error' && data.id == id) {
          clearTimeout(timeout);
          reject(ServiceError.fromResponse(data.error!));
        }
      });
    });
  }

  async notify(method: string, params: any) {
    await this.transceiver.send({
      metorialInterconnect: '1.0',
      type: 'notification',
      method,
      params
    });
  }

  onClose(callback: () => void, opts?: { once?: boolean }) {
    return this.transceiver.onClose(callback, opts);
  }

  onNotification(method: string, handler: (params: any) => any) {
    return this.transceiver.onMessage(data => {
      if (data.type == 'notification' && data.method == method) {
        try {
          handler(data.params);
        } catch (e) {
          console.error('Error handling notification', { method, error: e });
        }
      }
    });
  }

  onRequest(method: string, handler: (params: any) => Promise<any>) {
    return this.transceiver.onMessage(async data => {
      if (data.type == 'request' && data.method == method) {
        try {
          let res = await handler(data.params);

          await this.transceiver.send({
            metorialInterconnect: '1.0',
            type: 'response',
            id: data.id,
            result: res
          });
        } catch (e: any) {
          if (isServiceError(e)) {
            await this.transceiver.send({
              metorialInterconnect: '1.0',
              type: 'response/error',
              id: data.id,
              error: e.toResponse()
            });
          } else {
            sentry.captureException(e, {
              tags: {
                method,
                type: 'request'
              },
              extra: {
                data: data.params,
                error: e.message
              }
            });

            console.error('Error handling request', { method, error: e });

            await this.transceiver.send({
              metorialInterconnect: '1.0',
              type: 'response/error',
              id: data.id,
              error: {
                code: -32603,
                message: 'Internal error',
                data: { error: e.message }
              }
            });
          }
        }
      }
    });
  }

  close() {
    return this.transceiver.close();
  }
}
