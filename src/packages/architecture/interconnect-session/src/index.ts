import { generatePlainId } from '@metorial/id';
import { InterconnectChannelClient } from '@metorial/interconnect-base';
import { serialize } from '@metorial/serialize';
import { v, ValidationType, ValidationTypeValue } from '@metorial/validation';

let requestSchema = v.object({
  metorialInterconnect: v.literal('1.0'),
  type: v.literal('request'),
  id: v.string(),
  method: v.string(),
  params: v.record(v.any())
});

let notificationSchema = v.object({
  metorialInterconnect: v.literal('1.0'),
  type: v.literal('notification'),
  method: v.string(),
  params: v.record(v.any())
});

let responseSuccessSchema = v.object({
  metorialInterconnect: v.literal('1.0'),
  type: v.literal('response'),
  id: v.string(),
  result: v.record(v.any())
});

let responseErrorSchema = v.object({
  metorialInterconnect: v.literal('1.0'),
  type: v.literal('response'),
  id: v.string(),
  error: v.object({
    code: v.number(),
    message: v.string(),
    data: v.optional(v.record(v.any()))
  })
});

let messageSchema = v.union([
  requestSchema,
  notificationSchema,
  responseSuccessSchema,
  responseErrorSchema
]);

export class InterconnectError extends Error {
  constructor(
    public code: number,
    public message: string,
    public data?: Record<string, any>
  ) {
    super(message);
  }

  static isInterconnectError(error: any): error is InterconnectError {
    return error instanceof InterconnectError;
  }

  toResponse() {
    return {
      code: this.code,
      message: this.message,
      data: this.data
    };
  }
}

export type InterconnectMessage = ValidationTypeValue<typeof messageSchema>;
export type InterconnectRequest = ValidationTypeValue<typeof requestSchema>;
export type InterconnectNotification = ValidationTypeValue<typeof notificationSchema>;
export type InterconnectResponseSuccess = ValidationTypeValue<typeof responseSuccessSchema>;
export type InterconnectResponseError = ValidationTypeValue<typeof responseErrorSchema>;
export type InterconnectResponse = InterconnectResponseSuccess | InterconnectResponseError;

export class InterconnectSession {
  private methods = new Map<string, (cb: any) => Promise<any>>();
  private notifications = new Map<string, (cb: any) => Promise<any>>();
  private listeners = new Map<
    string,
    {
      resolve: (data: any) => void;
      reject: (error: InterconnectError) => void;
    }
  >();

  private rootId = generatePlainId();
  private idCounter = 0;

  getNextId() {
    this.idCounter++;
    if (this.idCounter > 1000000) this.rootId = generatePlainId();
    return `${this.rootId}-${this.idCounter}`;
  }

  method<T, R>(
    method: string,
    validation: ValidationType<T>,
    callback: (data: T) => Promise<R>
  ) {
    this.methods.set(method, async (data: any) => {
      let valRes = validation.validate(data);
      if (valRes.success) {
        return await callback(valRes.value);
      } else {
        throw new InterconnectError(
          -32602,
          `Invalid params for method ${method}: ${valRes.errors[0].message}`,
          { errors: valRes.errors }
        );
      }
    });
  }

  private send(data: InterconnectMessage) {
    return this.client.send(serialize.encode(data));
  }

  constructor(private client: InterconnectChannelClient) {
    client.onMessage(async str => {
      let data = serialize.decode(str);

      let valRes = messageSchema.validate(data);
      if (valRes.success) {
        let message = valRes.value;

        if (message.type == 'request') {
          try {
            let method = this.methods.get(message.method);
            if (!method) {
              throw new InterconnectError(-32601, `Method not found: ${message.method}`);
            }

            let result = await method(message.params);

            await this.send({
              metorialInterconnect: '1.0',
              type: 'response',
              id: message.id,
              result
            });
          } catch (error) {
            if (InterconnectError.isInterconnectError(error)) {
              await this.send({
                metorialInterconnect: '1.0',
                type: 'response',
                id: message.id,
                error: error.toResponse()
              });
            } else {
              console.error('Error in method:', error);
              await this.send({
                metorialInterconnect: '1.0',
                type: 'response',
                id: message.id,
                error: new InterconnectError(-32603, 'Internal server error').toResponse()
              });
            }
          }
        } else if (message.type == 'notification') {
          let method = this.notifications.get(message.method);
          if (method) {
            try {
              await method(message.params);
            } catch (error) {
              console.error('Error in notification:', error);
            }
          }
        } else if (message.type == 'response') {
          let listener = this.listeners.get(message.id);
          if (listener) {
            if ('error' in message) {
              listener.reject(
                new InterconnectError(
                  message.error.code,
                  message.error.message,
                  message.error.data
                )
              );
            } else {
              listener.resolve(message.result);
            }

            this.listeners.delete(message.id);
          }
        }
      }
    });
  }
}
