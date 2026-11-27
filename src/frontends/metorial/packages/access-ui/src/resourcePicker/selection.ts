import type { PickerBack, PickerItem, PickerSelection } from './types';

export type SelectionState<V> = {
  selected: PickerSelection<V>[];
  openKey: string | null;
  back: PickerBack | null;
  failedKeys: string[];
};

export let emptySelection = <V>(): SelectionState<V> => ({
  selected: [],
  openKey: null,
  back: null,
  failedKeys: []
});

export let isSelectionReady = <V>(selection: PickerSelection<V>) => {
  let settings = selection.item.settings;
  if (!settings?.isReady) return true;
  return settings.isReady(selection.value);
};

export let pendingOf = <V>(state: SelectionState<V>) =>
  state.selected.filter(selection => !isSelectionReady(selection));

export let findSelection = <V>(state: SelectionState<V>, key: string) =>
  state.selected.find(selection => selection.item.key == key);

export let setOpen = <V>(state: SelectionState<V>, key: string | null): SelectionState<V> => {
  if (key != null && !findSelection(state, key)?.item.settings) return state;
  if (key == state.openKey) return state;

  return { ...state, openKey: key, back: null };
};

export let select = <V>(state: SelectionState<V>, item: PickerItem<V>): SelectionState<V> => {
  if (findSelection(state, item.key)) return state;

  let next = {
    ...state,
    selected: [
      ...state.selected,
      { item, value: item.settings ? item.settings.initial : (item.value as V) }
    ]
  };

  return item.settings?.autoOpen ? setOpen(next, item.key) : next;
};

export let deselect = <V>(state: SelectionState<V>, key: string): SelectionState<V> => {
  if (!findSelection(state, key)) return state;

  return {
    ...state,
    selected: state.selected.filter(selection => selection.item.key != key),
    failedKeys: state.failedKeys.filter(failed => failed != key),
    openKey: state.openKey == key ? null : state.openKey,
    back: state.openKey == key ? null : state.back
  };
};

export let toggle = <V>(state: SelectionState<V>, item: PickerItem<V>, on: boolean) =>
  on ? select(state, item) : deselect(state, item.key);

export let setValue = <V>(
  state: SelectionState<V>,
  key: string,
  value: V
): SelectionState<V> => {
  if (!findSelection(state, key)) return state;

  return {
    ...state,
    selected: state.selected.map(selection =>
      selection.item.key == key ? { ...selection, value } : selection
    ),
    failedKeys: state.failedKeys.filter(failed => failed != key)
  };
};

export let setBack = <V>(
  state: SelectionState<V>,
  back: PickerBack | null
): SelectionState<V> => (state.openKey == null ? state : { ...state, back });

// After a partial failure only the failed picks stay selected, so a retry resends exactly those.
export let keepFailed = <V>(state: SelectionState<V>, keys: string[]): SelectionState<V> => {
  let failed = new Set(keys);
  let selected = state.selected.filter(selection => failed.has(selection.item.key));
  let openKey = state.openKey != null && failed.has(state.openKey) ? state.openKey : null;

  return {
    selected,
    openKey,
    back: openKey == null ? null : state.back,
    failedKeys: selected.map(selection => selection.item.key)
  };
};
