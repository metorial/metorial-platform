import { Callback, CallbackEvent } from '@metorial/db';
import { getAxiosSsrfFilter } from '@metorial/ssrf';
import axios from 'axios';
import { CallbackHandler } from '../../base/callbackHandler';

export class PythonCallbackHandler extends CallbackHandler {
  async handleCallback(d: {
    events: CallbackEvent[];
    callback: Callback;
  }): Promise<
    ({ event: CallbackEvent } & (
      | { success: false; error: { code: string; message: string } }
      | { success: true; result: any; type: string }
    ))[]
  > {
    let url = this.lambda.providerResourceAccessIdentifier;
    if (!url) throw new Error('WTF - no url for lambda server instance');

    try {
      let res = await axios.post<{
        results: { success: boolean; eventId: string; error?: string; result?: any }[];
      }>(
        `${url}/callbacks/handle`,
        {
          callbackId: d.callback.id,
          events: d.events.map(e => ({
            eventId: e.id,
            payload: JSON.parse(e.payloadIncoming)
          }))
        },
        {
          ...getAxiosSsrfFilter(url),
          headers: {
            'metorial-stellar-token': this.lambda.securityToken
          }
        }
      );

      let eventMap = new Map(res.data.results.map(r => [r.eventId, r]));

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
    let url = this.lambda.providerResourceAccessIdentifier;
    if (!url) throw new Error('WTF - no url for lambda server instance');

    try {
      await axios.post(
        `${url}/callbacks/install`,
        {
          callbackId: d.callback.id,
          callbackUrl: d.url
        },
        {
          ...getAxiosSsrfFilter(url),
          headers: {
            'metorial-stellar-token': this.lambda.securityToken
          }
        }
      );

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
    let url = this.lambda.providerResourceAccessIdentifier;
    if (!url) throw new Error('WTF - no url for lambda server instance');

    try {
      let res = await axios.post<{
        events: any[];
        newState: any;
      }>(
        `${url}/callbacks/poll`,
        {
          callbackId: d.callback.id,
          state: d.state
        },
        {
          ...getAxiosSsrfFilter(url),
          headers: {
            'metorial-stellar-token': this.lambda.securityToken
          }
        }
      );

      return {
        success: true as const,
        events: res.data.events,
        newState: res.data.newState
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
