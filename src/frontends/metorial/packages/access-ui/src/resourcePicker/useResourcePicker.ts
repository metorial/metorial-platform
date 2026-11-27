import { useEffect, useMemo, useState } from 'react';
import {
  deselect,
  emptySelection,
  findSelection,
  keepFailed,
  pendingOf,
  setBack,
  setOpen,
  setValue,
  toggle,
  type SelectionState
} from './selection';
import type { PickerBack, PickerItem } from './types';

let defaultDebounceMs = 250;

let useDebouncedValue = <T>(value: T, ms: number) => {
  let [debounced, setDebounced] = useState(value);

  useEffect(() => {
    let timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return debounced;
};

export let useResourcePicker = <V = unknown>(opts?: { debounceMs?: number }) => {
  let [search, setSearch] = useState('');
  let query = useDebouncedValue(search.trim(), opts?.debounceMs ?? defaultDebounceMs);
  let [state, setState] = useState<SelectionState<V>>(emptySelection);

  let pending = useMemo(() => pendingOf(state), [state]);

  return {
    search,
    setSearch,
    query: query || undefined,

    selected: state.selected,
    openKey: state.openKey,
    back: state.back,
    failedKeys: state.failedKeys,
    pending,

    get: (key: string) => findSelection(state, key),
    isSelected: (key: string) => !!findSelection(state, key),
    toggle: (item: PickerItem<V>, on: boolean) => setState(s => toggle(s, item, on)),
    remove: (key: string) => setState(s => deselect(s, key)),
    setValue: (key: string, value: V) => setState(s => setValue(s, key, value)),
    setOpen: (key: string | null) => setState(s => setOpen(s, key)),
    setBack: (back: PickerBack | null) => setState(s => setBack(s, back)),
    keepFailed: (keys: string[]) => setState(s => keepFailed(s, keys)),
    clear: () => setState(emptySelection<V>())
  };
};

export type ResourcePickerState<V = unknown> = ReturnType<typeof useResourcePicker<V>>;
