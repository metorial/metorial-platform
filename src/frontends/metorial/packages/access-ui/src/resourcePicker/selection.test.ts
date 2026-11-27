import { describe, expect, it } from 'vitest';
import {
  deselect,
  emptySelection,
  findSelection,
  keepFailed,
  pendingOf,
  select,
  setBack,
  setOpen,
  setValue,
  toggle,
  type SelectionState
} from './selection';
import type { PickerItem } from './types';

type Value = { choice: string | null };

let plain = (key: string): PickerItem<Value> => ({ key, title: key, icon: () => null });

let configurable = (key: string, opts?: { autoOpen?: boolean }): PickerItem<Value> => ({
  key,
  title: key,
  icon: () => null,
  settings: {
    initial: { choice: null },
    autoOpen: opts?.autoOpen ?? true,
    isReady: value => value.choice != null,
    summary: value => value.choice,
    needs: 'Pick one',
    render: () => null
  }
});

let start = () => emptySelection<Value>();

let keys = (state: SelectionState<Value>) => state.selected.map(s => s.item.key);

describe('select', () => {
  it('adds an item once, with its initial settings value', () => {
    let state = select(start(), configurable('slack'));
    state = select(state, configurable('slack'));

    expect(keys(state)).toEqual(['slack']);
    expect(findSelection(state, 'slack')?.value).toEqual({ choice: null });
  });

  it('uses the fixed value when the item has no settings', () => {
    let state = select(start(), { ...plain('ada'), value: { choice: 'fixed' } });

    expect(findSelection(state, 'ada')?.value).toEqual({ choice: 'fixed' });
  });

  it('opens settings on select only when the item asks for it', () => {
    expect(select(start(), configurable('slack')).openKey).toBe('slack');
    expect(select(start(), configurable('qbr', { autoOpen: false })).openKey).toBeNull();
    expect(select(start(), plain('ada')).openKey).toBeNull();
  });

  it('keeps selection order', () => {
    let state = select(select(select(start(), plain('a')), plain('c')), plain('b'));

    expect(keys(state)).toEqual(['a', 'c', 'b']);
  });
});

describe('deselect', () => {
  it('closes the row and clears its failure and back button', () => {
    let state = select(start(), configurable('slack'));
    state = setBack(state, { label: 'Back', onBack: () => {} });
    state = { ...state, failedKeys: ['slack'] };
    state = deselect(state, 'slack');

    expect(state).toEqual(start());
  });

  it('leaves another open row alone', () => {
    let state = select(start(), plain('ada'));
    state = select(state, configurable('slack'));
    state = deselect(state, 'ada');

    expect(state.openKey).toBe('slack');
  });

  it('toggle maps on/off to select/deselect', () => {
    let state = toggle(start(), plain('ada'), true);
    expect(keys(state)).toEqual(['ada']);

    state = toggle(state, plain('ada'), false);
    expect(keys(state)).toEqual([]);
  });
});

describe('pending', () => {
  it('lists selections whose settings are not ready', () => {
    let state = select(start(), configurable('slack'));
    state = select(state, configurable('linear'));
    state = select(state, plain('ada'));
    state = setValue(state, 'slack', { choice: 'Shared · Support Bot' });

    expect(pendingOf(state).map(s => s.item.key)).toEqual(['linear']);
  });

  it('ignores setValue for items that are not selected', () => {
    let state = setValue(start(), 'slack', { choice: 'x' });

    expect(state).toEqual(start());
  });
});

describe('setOpen', () => {
  it('only opens selected rows that have settings', () => {
    let state = select(start(), plain('ada'));

    expect(setOpen(state, 'ada').openKey).toBeNull();
    expect(setOpen(state, 'linear').openKey).toBeNull();
  });

  it('drops the back button when another row opens', () => {
    let state = select(start(), configurable('slack'));
    state = select(state, configurable('linear', { autoOpen: false }));
    state = setOpen(state, 'slack');
    state = setBack(state, { label: 'Back', onBack: () => {} });
    state = setOpen(state, 'linear');

    expect(state.openKey).toBe('linear');
    expect(state.back).toBeNull();
  });

  it('ignores a back button when nothing is open', () => {
    let state = setBack(select(start(), plain('ada')), { label: 'Back', onBack: () => {} });

    expect(state.back).toBeNull();
  });
});

describe('keepFailed', () => {
  it('keeps only the failed picks, with their values, and marks them', () => {
    let state = select(start(), configurable('slack'));
    state = setValue(state, 'slack', { choice: 'Each person connects · Slack' });
    state = select(state, plain('ada'));
    state = select(state, plain('ben'));
    state = keepFailed(state, ['slack', 'ben']);

    expect(keys(state)).toEqual(['slack', 'ben']);
    expect(state.failedKeys).toEqual(['slack', 'ben']);
    expect(findSelection(state, 'slack')?.value).toEqual({
      choice: 'Each person connects · Slack'
    });
  });

  it('closes the open row when it succeeded', () => {
    let state = select(start(), configurable('slack'));
    state = select(state, plain('ada'));
    state = keepFailed(state, ['ada']);

    expect(state.openKey).toBeNull();
  });

  it('clears the failure mark once the value changes', () => {
    let state = select(start(), configurable('slack'));
    state = keepFailed(state, ['slack']);
    state = setValue(state, 'slack', { choice: 'Shared · Bot' });

    expect(state.failedKeys).toEqual([]);
  });
});
