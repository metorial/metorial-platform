import { getAtPath, type JsonValue, prefixPatch } from '@lowerdeck/patch';
import type { ConfigHook, ConfigHookOptions } from './types';

export let createPathConfigHook =
  <B, Options extends ConfigHookOptions, Extra extends object = {}>(
    inner: ConfigHook<any, Options>,
    usePath: (options?: Options & Extra) => string[] | null
  ): ConfigHook<B, Options & Extra> =>
  options => {
    let path = usePath(options);
    let state = inner(options);

    return {
      ...state,
      value: (path ? getAtPath(state.value, path) : undefined) as B,
      isReady: state.isReady && !!path,
      patch: operations =>
        path ? state.patch(prefixPatch(operations, path)) : Promise.resolve(false),
      set: next => {
        if (!path) return Promise.resolve(false);

        return state.patch(
          next === undefined
            ? [{ op: 'unset', path }]
            : [{ op: 'set', path, value: next as JsonValue }]
        );
      }
    };
  };
