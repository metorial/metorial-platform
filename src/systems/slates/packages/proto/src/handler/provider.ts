import {
  badRequestError,
  internalServerError,
  isServiceError,
  notFoundError,
  validationError
} from '@lowerdeck/error';
import type z from 'zod';
import {
  type SlatesNotifications,
  type SlatesRequests,
  type SlatesResponsesByMethod,
  slatesNotificationsByMethod,
  slatesRequestsByMethod
} from '../messages';

export class SlatesProviderProtoHandlerManager {
  #implMap = new Map<
    string,
    {
      type: 'request' | 'notification';
      handler: Function;
      schema: z.ZodType<any>;
    }
  >();

  onNotification<Method extends SlatesNotifications['method']>(
    method: Method,
    handler: (message: Extract<SlatesNotifications, { method: Method }>) => void
  ) {
    let schema = slatesNotificationsByMethod[method];
    if (!schema) {
      throw new Error(`No schema found for method: ${method}`);
    }

    this.#implMap.set(method, {
      type: 'notification',
      handler,
      schema
    });
  }

  onRequest<Method extends SlatesRequests['method']>(
    method: Method,
    cb: (
      message: Extract<SlatesRequests, { method: Method }>
    ) => Promise<SlatesResponsesByMethod[Method]['result']>
  ) {
    let schema = slatesRequestsByMethod[method];
    if (!schema) {
      throw new Error(`No schema found for method: ${method}`);
    }

    this.#implMap.set(method, {
      type: 'request',
      handler: cb,
      schema
    });
  }

  private async _handleInput(input: SlatesNotifications | SlatesRequests) {
    try {
      if (typeof input !== 'object' || input === null) {
        return {
          jsonrpc: '2.0' as const,
          id: (input as any).id,
          error: badRequestError({ message: 'Invalid input' }).toResponse()
        };
      }

      if (input.jsonrpc !== '2.0') {
        return {
          jsonrpc: '2.0' as const,
          id: (input as any).id,
          error: badRequestError({ message: 'Invalid jsonrpc version' }).toResponse()
        };
      }

      let method = input.method;
      if (typeof method !== 'string') {
        return {
          jsonrpc: '2.0' as const,
          id: (input as any).id,
          error: badRequestError({ message: 'Invalid or missing method' }).toResponse()
        };
      }

      let impl = this.#implMap.get(input.method);
      if (!impl) {
        return {
          jsonrpc: '2.0' as const,
          id: (input as any).id,
          error: notFoundError('handler', input.method).toResponse()
        };
      }

      let parsed = impl.schema.safeParse(input);
      if (!parsed.success) {
        return {
          jsonrpc: '2.0' as const,
          id: (input as any).id,
          error: validationError({
            entity: 'request',
            message: 'Invalid request parameters',
            errors: parsed.error.issues.map(i => ({
              ...i,
              path: i.path.map(p => String(p))
            }))
          }).toResponse()
        };
      }

      if (impl.type === 'notification') {
        await impl.handler(parsed.data);
        return;
      }

      let result = await impl.handler(parsed.data);

      return {
        jsonrpc: '2.0' as const,
        id: parsed.data.id,
        result
      };
    } catch (err) {
      if (isServiceError(err)) {
        return {
          jsonrpc: '2.0' as const,
          id: (input as any).id,
          error: err.toResponse()
        };
      }

      console.error(err);

      return {
        jsonrpc: '2.0' as const,
        id: (input as any).id,
        error: internalServerError({ message: 'Internal server error' }).toResponse()
      };
    }
  }

  static async handleInput(
    manager: SlatesProviderProtoHandlerManager,
    input: SlatesNotifications | SlatesRequests
  ) {
    return manager._handleInput(input);
  }
}

export let createSlatesProviderProtoHandler = (
  cb: (manager: SlatesProviderProtoHandlerManager) => Promise<void>
) => ({
  run: async () => {
    let manager = new SlatesProviderProtoHandlerManager();

    await cb(manager);

    return manager;
  }
});
