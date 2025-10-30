import { Callback, CallbackEvent, LambdaServerInstance } from '@metorial/db';
import { Service } from '@metorial/service';
import { getCallbackHandler } from '../deployment';

class LambdaServerCallbackServiceImpl {
  async handleLambdaServerCallback(d: {
    events: CallbackEvent[];
    callback: Callback;
    lambda: LambdaServerInstance;
  }) {
    return getCallbackHandler(d.lambda).handleCallback({
      events: d.events,
      callback: d.callback
    });
  }

  async installLambdaServerCallback(d: {
    callback: Callback;
    lambda: LambdaServerInstance;
    url: string;
  }) {
    return getCallbackHandler(d.lambda).installCallback({
      callback: d.callback,
      url: d.url
    });
  }

  async pollLambdaServerCallback(d: {
    callback: Callback;
    lambda: LambdaServerInstance;
    state: any;
  }) {
    return getCallbackHandler(d.lambda).pollCallback({
      callback: d.callback,
      state: d.state
    });
  }
}

export let lambdaServerCallbackService = Service.create(
  'lambdaServerCallback',
  () => new LambdaServerCallbackServiceImpl()
).build();
