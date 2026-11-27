import type { JsonValue } from '@lowerdeck/patch';
import type { ConfigHook, ConfigHookOptionsOf, ConfigHookValue } from './types';

let noEntries: Record<string, any> = {};

export let createRecordConfigHook =
  <H extends ConfigHook<Record<string, JsonValue> | undefined, any>>(inner: H) =>
  (options?: ConfigHookOptionsOf<H>) => {
    type Value = NonNullable<ConfigHookValue<H>>[string];

    let state = inner(options);
    let entries = (state.value ?? noEntries) as Record<string, Value>;

    return {
      entries,
      isLoading: state.isLoading,
      isReady: state.isReady,
      error: state.error,

      get: (key: string) =>
        Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : undefined,
      setKey: (key: string, value: Value) =>
        state.patch([{ op: 'set', path: [key], value: value as JsonValue }]),
      removeKey: (key: string) => state.patch([{ op: 'unset', path: [key] }]),
      replace: (next: Record<string, Value>) => state.set(next)
    };
  };
