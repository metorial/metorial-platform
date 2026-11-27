// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiSelect } from './index';

// The real checkbox imports the package index, which cannot load in isolation.
vi.mock('../checkbox', () => ({
  Checkbox: (props: {
    checked?: boolean;
    label?: string;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={!!props.checked}
      onClick={() => props.onCheckedChange?.(!props.checked)}
    >
      {props.label}
    </button>
  )
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let items = [
  { id: 'alpha', label: 'Alpha', description: 'First' },
  { id: 'beta', label: 'Beta' }
];

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

let Harness = ({
  initial = [],
  searchable,
  onChange,
  onSearchChange
}: {
  initial?: string[];
  searchable?: boolean;
  onChange?: (value: string[]) => void;
  onSearchChange?: (query: string) => void;
}) => {
  let [value, setValue] = useState(initial);

  return (
    <MultiSelect
      label="Options"
      items={items}
      value={value}
      searchable={searchable}
      onSearchChange={onSearchChange}
      onChange={next => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
};

let trigger = () => container.querySelector('button[aria-haspopup]') as HTMLButtonElement;

let popover = () => document.querySelector('[data-radix-popper-content-wrapper]');

let search = () => document.querySelector('input[type="search"]') as HTMLInputElement | null;

let listedLabels = () =>
  [...document.querySelectorAll('[role="checkbox"]')].map(element => element.textContent);

let click = async (element: Element) => {
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

let type = async (value: string) => {
  await act(async () => {
    let setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(search(), value);
    search()!.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('MultiSelect', () => {
  it('keeps checkboxes, chips and the open popover while picking', async () => {
    let onChange = vi.fn();
    await act(async () => root.render(<Harness initial={['beta']} onChange={onChange} />));
    expect(trigger().textContent).toBe('Beta');

    await click(trigger());
    expect(search()).toBeNull();
    expect(listedLabels()).toEqual(['Alpha', 'Beta']);

    await click(document.querySelector('[role="checkbox"][aria-checked="false"]')!);
    expect(onChange).toHaveBeenLastCalledWith(['beta', 'alpha']);
    expect(popover()).not.toBeNull();
    expect(trigger().textContent).toBe('AlphaBeta');
  });

  it('filters the items itself when the parent does not handle the search', async () => {
    await act(async () => root.render(<Harness searchable />));

    await click(trigger());
    expect(document.activeElement).toBe(search());

    await type('fir');
    expect(listedLabels()).toEqual(['Alpha']);

    await type('nothing');
    expect(listedLabels()).toEqual([]);
    expect(popover()?.textContent).toContain('No results found.');

    await type('');
    expect(listedLabels()).toEqual(['Alpha', 'Beta']);
  });

  it('leaves filtering to the parent and keeps chosen values listed', async () => {
    let onSearchChange = vi.fn();
    await act(async () =>
      root.render(<Harness searchable initial={['gamma']} onSearchChange={onSearchChange} />)
    );

    await click(trigger());
    await type('zzz');
    expect(onSearchChange).toHaveBeenLastCalledWith('zzz');
    expect(listedLabels()).toEqual(['gamma', 'Alpha', 'Beta']);
  });

  it('clears the search on close and tells the parent', async () => {
    let onSearchChange = vi.fn();
    await act(async () => root.render(<Harness searchable onSearchChange={onSearchChange} />));

    await click(trigger());
    await type('alp');
    expect(onSearchChange).toHaveBeenLastCalledWith('alp');

    await click(trigger());
    expect(popover()).toBeNull();
    expect(onSearchChange).toHaveBeenLastCalledWith('');

    await click(trigger());
    expect(search()!.value).toBe('');
  });
});
