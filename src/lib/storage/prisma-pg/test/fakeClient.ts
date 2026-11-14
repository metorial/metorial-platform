import { EventEmitter } from 'node:events';
import type pg from 'pg';

export let dnsError = (code = 'EAI_AGAIN') =>
  Object.assign(new Error(`getaddrinfo ${code} database.test`), {
    code,
    syscall: 'getaddrinfo',
    hostname: 'database.test'
  });

export let createFakePg = () => {
  let state = {
    connectErrors: [] as (Error | undefined)[],
    connectCount: 0,
    queries: [] as string[],
    queryError: undefined as Error | undefined,
    failQuery: undefined as string | undefined,
    connected: undefined as (() => void) | undefined
  };

  class FakeClient extends EventEmitter {
    _queryable = true;

    _ending = false;

    connect(callback: (error?: Error) => void) {
      state.connectCount += 1;
      let error = state.connectErrors.shift();

      Promise.resolve().then(() => {
        state.connected?.();
        callback(error);
      });
    }

    query(
      config: string | { text: string },
      values?: unknown,
      callback?: (error: Error | undefined, result?: unknown) => void
    ) {
      let text = typeof config === 'string' ? config : config.text;
      state.queries.push(text);

      let error =
        !state.failQuery || text.includes(state.failQuery) ? state.queryError : undefined;
      let result = {
        rows: [['synthetic-test']],
        fields: [{ name: 'id', dataTypeID: 25 }],
        rowCount: 1,
        command: 'SELECT'
      };
      let done = typeof values === 'function' ? values : callback;

      if (done) {
        Promise.resolve().then(() => done(error, result));
        return;
      }

      return error ? Promise.reject(error) : Promise.resolve(result);
    }

    end(callback?: () => void) {
      this._ending = true;
      Promise.resolve().then(() => {
        this.emit('end');
        callback?.();
      });
    }

    ref() {}

    unref() {}
  }

  return { Client: FakeClient as unknown as typeof pg.Client, state };
};
