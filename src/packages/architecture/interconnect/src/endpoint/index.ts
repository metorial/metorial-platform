import { debug } from '@metorial/debug';
import { badRequestError, ServiceError } from '@metorial/error';
import { ValidationType } from '@metorial/validation';
import { MICTransceiver } from '../connection/base';
import { MICSessionManger } from '../connection/session';

export class MICEndpoint {
  private notificationHandlers = new Map<
    string,
    (notification: any, ctx: MICSessionManger) => Promise<any>
  >();
  private requestHandlers = new Map<
    string,
    (request: any, ctx: MICSessionManger) => Promise<any>
  >();

  notification<T>(
    method: string,
    schema: ValidationType<T>,
    handler: (input: T, ctx: MICSessionManger) => Promise<any>
  ) {
    this.notificationHandlers.set(method, async (ntnf, ctx) => {
      let valRes = schema.validate(ntnf);
      if (!valRes.success) {
        debug.log('Invalid notification', {
          method,
          error: valRes.errors,
          data: ntnf
        });

        return;
      }

      return handler(valRes.value, ctx);
    });

    return this;
  }

  request<T>(
    method: string,
    schema: ValidationType<T>,
    handler: (input: T, ctx: MICSessionManger) => Promise<any>
  ) {
    this.requestHandlers.set(method, async (req, ctx) => {
      let valRes = schema.validate(req);
      if (!valRes.success) {
        debug.log('Invalid request', {
          method,
          error: valRes.errors,
          data: req
        });

        throw new ServiceError(
          badRequestError({
            message: 'Invalid params',
            data: valRes.errors
          })
        );
      }

      return await handler(valRes.value, ctx);
    });

    return this;
  }

  connect(transceiverOrManager: MICTransceiver | MICSessionManger) {
    let manager =
      transceiverOrManager instanceof MICTransceiver
        ? new MICSessionManger(transceiverOrManager)
        : transceiverOrManager;

    for (let [method, handler] of this.notificationHandlers) {
      manager.onNotification(method, ntnf => {
        return handler(ntnf, manager);
      });
    }

    for (let [method, handler] of this.requestHandlers) {
      manager.onRequest(method, req => {
        return handler(req, manager);
      });
    }
  }
}
