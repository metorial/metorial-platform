import { Callback, CallbackEvent, LambdaServerInstance } from '@metorial/db';

export abstract class CallbackHandler {
  constructor(public readonly lambda: LambdaServerInstance) {}

  abstract handleCallback(d: { events: CallbackEvent[]; callback: Callback }): Promise<
    ({
      event: CallbackEvent;
    } & (
      | {
          success: false;
          error: {
            code: string;
            message: string;
          };
        }
      | {
          success: true;
          result: any;
          type: string;
        }
    ))[]
  >;

  abstract installCallback(d: {
    callback: Callback;

    url: string;
  }): Promise<
    | { success: true }
    | {
        success: false;
        error: {
          code: string;
          message: string;
        };
      }
  >;

  abstract pollCallback(d: {
    callback: Callback;
    state: any;
  }): Promise<
    | { success: true; events: CallbackEvent[]; newState: any }
    | { success: false; error: { code: string; message: string } }
  >;
}
