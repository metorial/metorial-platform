declare var self: Worker;

import jsonata from 'jsonata';

type RequestMessage = {
  id: number;
  expression: string;
  input: unknown;
};

type ResponseMessage = {
  id: number;
  result?: unknown;
  error?: string;
};

self.addEventListener('message', async (event: MessageEvent<RequestMessage>) => {
  let id = event.data.id;

  try {
    let expr = jsonata(event.data.expression);
    let result = await expr.evaluate(event.data.input);

    let response: ResponseMessage = {
      id,
      result
    };

    self.postMessage(response);
  } catch (err) {
    let response: ResponseMessage = {
      id,
      error: err instanceof Error ? err.message : String(err)
    };

    self.postMessage(response);
  }
});
