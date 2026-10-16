// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from '../dialog';
import { Combobox, type ComboboxProviderResult } from './index';

vi.mock('../menu', () => ({ Menu: () => null }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let items = [
  { id: 'alpha', label: 'Alpha' },
  { id: 'beta', label: 'Beta' }
];

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

let render = async (children: React.ReactNode) => {
  await act(async () => root.render(children));
};

let input = () => document.querySelector('input[role="combobox"]') as HTMLInputElement;

let focus = async () => {
  await act(async () => input().focus());
};

let type = async (value: string) => {
  await act(async () => {
    let setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input(), value);
    input().dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: value ? 'insertText' : 'deleteContentBackward',
        data: value || null
      })
    );
  });
};

let key = async (key: string) => {
  await act(async () =>
    input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  );
};

let positioner = () => document.querySelector('[data-side]') as HTMLElement;

describe('loading popover', () => {
  it.each([
    { name: 'flat items', items: [] },
    { name: 'empty groups', items: [{ label: 'Group', items: [] }] }
  ])('hides the whole popover with $name while keeping the spinner', async ({ items }) => {
    await render(
      <Combobox
        label="Options"
        provider={() => ({ items, isLoading: true, status: 'Loading status' })}
      />
    );
    await focus();

    expect(positioner().style.display).toBe('none');
    expect(positioner().textContent).toContain('Loading status');
    expect(positioner().textContent).not.toContain('No results found.');
    expect(container.querySelector('[aria-hidden="false"]')).not.toBeNull();
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it.each([true, false])(
    'reveals completed results (has items: %s) without refocusing',
    async hasItems => {
      let result: ComboboxProviderResult = { items: [], isLoading: true };
      let component = <Combobox label="Options" provider={() => result} />;
      await render(component);
      await focus();

      result = { items: hasItems ? items : [], isLoading: false };
      await render(<Combobox label="Options" provider={() => result} />);

      expect(positioner().style.display).toBe('');
      expect(positioner().textContent).toContain(hasItems ? 'Alpha' : 'No results found.');
      expect(document.activeElement).toBe(input());
    }
  );

  it('keeps cached options visible during refresh', async () => {
    let isLoading = false;
    let provider = () => ({ items: isLoading ? [] : items, isLoading });
    await render(<Combobox label="Options" provider={provider} />);
    await focus();

    isLoading = true;
    await render(<Combobox label="Options" provider={provider} />);

    expect(positioner().style.display).toBe('');
    expect(positioner().textContent).toContain('Alpha');
  });

  it('keeps live options visible while loading', async () => {
    await render(<Combobox label="Options" provider={() => ({ items, isLoading: true })} />);
    await focus();

    expect(positioner().style.display).toBe('');
    expect(positioner().textContent).toContain('Alpha');
  });
});

describe('search input', () => {
  it.each(['static', 'provider'])(
    'preserves the first character after clearing in %s mode',
    async mode => {
      vi.useFakeTimers();
      let onSearchChange = vi.fn();
      let provider = vi.fn(() => ({ items: [], isLoading: true }));
      await render(
        mode === 'static' ? (
          <Combobox items={items} onSearchChange={onSearchChange} />
        ) : (
          <Combobox provider={provider} onSearchChange={onSearchChange} />
        )
      );
      await focus();
      await type('abc');
      await act(async () => vi.advanceTimersByTime(500));
      await type('');
      onSearchChange.mockClear();
      await type('b');

      expect(input().value).toBe('b');
      expect(onSearchChange.mock.calls).toEqual([['b']]);
      await act(async () => vi.advanceTimersByTime(500));
      expect(input().value).toBe('b');
      expect(onSearchChange.mock.calls).toEqual([['b']]);

      if (mode === 'provider') {
        expect(provider).toHaveBeenLastCalledWith({
          search: 'b',
          searchQuery: 'b',
          value: undefined
        });
      }
    }
  );

  it('preserves selection and restores its label on Escape and blur', async () => {
    let onChange = vi.fn();
    let SelectedCombobox = () => {
      let [value, setValue] = useState<string | null>(null);

      return (
        <Combobox
          label="Options"
          items={items}
          value={value}
          onChange={(value, item) => {
            setValue(value);
            onChange(value, item);
          }}
        />
      );
    };

    await render(
      <>
        <SelectedCombobox />
        <button id="outside">Outside</button>
      </>
    );
    await focus();
    await type('Al');
    await key('ArrowDown');
    await key('Enter');

    expect(onChange).toHaveBeenLastCalledWith('alpha', items[0]);
    expect(input().value).toBe('Alpha');
    await act(async () => (container.querySelector('button') as HTMLButtonElement).click());
    expect(input().value).toBe('');
    await type('Be');
    await key('Escape');
    expect(input().value).toBe('Alpha');

    await act(async () => document.getElementById('outside')!.focus());
    await focus();
    expect(input().value).toBe('');
    await type('Be');
    await act(async () => {
      document.getElementById('outside')!.focus();
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(input().value).toBe('Alpha');
  });

  it('keeps typing functional while the popover is hidden inside a dialog', async () => {
    await render(
      <Dialog.Wrapper isOpen onOpenChange={() => {}}>
        <Dialog.Title>Choose Option</Dialog.Title>
        <Dialog.Description>Search options.</Dialog.Description>
        <Combobox provider={() => ({ items: [], isLoading: true })} />
      </Dialog.Wrapper>
    );
    await focus();
    await type('abc');
    await type('');
    await type('b');

    expect(input().value).toBe('b');
    expect(positioner().style.display).toBe('none');
    expect(document.activeElement).toBe(input());
  });
});
