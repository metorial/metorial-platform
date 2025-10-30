import { Callback, CallbackEvent } from '@metorial/db';
import { CallbackHandler } from '../../base/callbackHandler';
import { invokeLambdaCallbacks } from '../lib/invokeLambda';

export class AwsLambdaCallbackHandler extends CallbackHandler {
  async handleCallback(d: {
    events: CallbackEvent[];
    callback: Callback;
  }): Promise<
    ({ event: CallbackEvent } & (
      | { success: false; error: { code: string; message: string } }
      | { success: true; result: any; type: string }
    ))[]
  > {
    try {
      let res = (await invokeLambdaCallbacks({
        functionName: this.lambda.providerResourceAccessIdentifier!,
        callbackAction: 'handle',
        input: {
          callbackId: d.callback.id,
          events: d.events.map(e => ({
            eventId: e.id,
            payload: JSON.parse(e.payloadIncoming)
          }))
        }
      })) as {
        callbacks: {
          results: { success: boolean; eventId: string; error?: string; result?: any }[];
        };
      };

      let eventMap = new Map(res.callbacks.results.map(r => [r.eventId, r]));

      return d.events.map(e => {
        let r = eventMap.get(e.id);
        if (!r) {
          return {
            event: e,
            success: false as const,
            error: {
              code: 'execution_error',
              message: 'Unable to run callback on server (no result returned)'
            }
          };
        }

        if (r.success) {
          let fullResult = r.result;
          if (fullResult === null) {
            return {
              event: e,
              result: null,
              type: 'noop',
              success: true as const
            };
          }

          if (
            typeof fullResult != 'object' ||
            fullResult === null ||
            Array.isArray(fullResult) ||
            typeof fullResult.type !== 'string' ||
            !('result' in fullResult)
          ) {
            return {
              event: e,
              success: false as const,
              error: {
                code: 'invalid_result',
                message: 'Invalid result format returned from server'
              }
            };
          }

          return {
            event: e,
            result: fullResult.result,
            type: fullResult.type,
            success: true as const
          };
        } else {
          return {
            event: e,
            success: false as const,
            error: {
              code: 'server_error',
              message: r.error ?? 'Unknown server error'
            }
          };
        }
      });
    } catch (e) {
      return d.events.map(e => ({
        event: e,
        success: false as const,
        error: {
          code: 'execution_error',
          message: 'Unable to run callback on server'
        }
      }));
    }
  }

  async installCallback(d: {
    callback: Callback;
    url: string;
  }): Promise<
    { success: true } | { success: false; error: { code: string; message: string } }
  > {
    try {
      await invokeLambdaCallbacks({
        functionName: this.lambda.providerResourceAccessIdentifier!,
        callbackAction: 'install',
        input: {
          callbackId: d.callback.id,
          callbackUrl: d.url
        }
      });

      return { success: true as const };
    } catch (e) {
      return {
        success: false as const,
        error: {
          code: 'installation_error',
          message: 'Unable to install callback on server'
        }
      };
    }
  }

  async pollCallback(d: {
    callback: Callback;
    state: any;
  }): Promise<
    | { success: true; events: CallbackEvent[]; newState: any }
    | { success: false; error: { code: string; message: string } }
  > {
    try {
      let res = await invokeLambdaCallbacks({
        functionName: this.lambda.providerResourceAccessIdentifier!,
        callbackAction: 'poll',
        input: {
          callbackId: d.callback.id,
          state: d.state
        }
      });

      return {
        success: true as const,
        events: res.callbacks.events,
        newState: res.callbacks.newState
      };
    } catch (e: any) {
      return {
        success: false as const,
        error: {
          code: 'poll_error',
          message: e.response?.data?.message || 'Unable to poll callback'
        }
      };
    }
  }
}
