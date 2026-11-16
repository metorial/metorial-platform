import { jsonEquals, type JsonValue } from '@lowerdeck/patch';
import type { ConfigHook, ConfigHookOptionsOf, ConfigHookValue } from './types';

let noItems: any[] = [];

export let createSetConfigHook =
  <H extends ConfigHook<JsonValue[] | undefined, any>>(inner: H) =>
  (options?: ConfigHookOptionsOf<H>) => {
    type Item = NonNullable<ConfigHookValue<H>>[number];

    let state = inner(options);
    let items = (state.value ?? noItems) as Item[];

    let has = (item: Item) => items.some(existing => jsonEquals(existing, item));
    let add = (item: Item) => state.patch([{ op: 'add', path: [], value: item }]);
    let remove = (item: Item) => state.patch([{ op: 'remove', path: [], value: item }]);

    return {
      items,
      isLoading: state.isLoading,
      isReady: state.isReady,
      error: state.error,

      has,
      add,
      remove,
      toggle: (item: Item) => (has(item) ? remove(item) : add(item)),
      replace: (next: Item[]) => state.set(next)
    };
  };
