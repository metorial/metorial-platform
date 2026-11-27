// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Slider } from './index';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let stops = [
  { value: 0.5, label: '0.5' },
  { value: 1, label: '1', disabled: true },
  { value: 2, label: '2' }
];

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

let typeValue = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    let setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, value);
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });
};

describe('discrete slider', () => {
  it('shows unavailable stops without allowing selection', async () => {
    let onChange = vi.fn();
    await act(async () =>
      root.render(<Slider label="CPU" stops={stops} value={0.5} onChange={onChange} />)
    );

    let unavailable = container.querySelectorAll('button')[1];
    expect(unavailable.textContent).toBe('1');
    expect(unavailable.disabled).toBe(true);
    await act(async () => unavailable.click());
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => container.querySelectorAll('button')[2].click());
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('skips unavailable stops when navigating with the keyboard', async () => {
    let onChange = vi.fn();
    await act(async () =>
      root.render(<Slider label="CPU" stops={stops} value={0.5} onChange={onChange} />)
    );

    await act(async () =>
      container
        .querySelector('[role="slider"]')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
        )
    );
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('shows sparse labels while keeping unlabelled steps selectable', async () => {
    let onChange = vi.fn();
    let manyStops = Array.from({ length: 9 }, (_, value) => ({ value, label: String(value) }));
    await act(async () =>
      root.render(<Slider label="CPU" stops={manyStops} value={0} onChange={onChange} />)
    );

    expect(
      [...container.querySelectorAll('button')].map(button => button.textContent)
    ).toEqual(['0', '2', '4', '6', '8']);
    await act(async () =>
      container
        .querySelector('[role="slider"]')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
        )
    );
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('accepts a typed step and displays its unit', async () => {
    let onChange = vi.fn();
    let onValueCommit = vi.fn();
    await act(async () =>
      root.render(
        <Slider
          label="Memory"
          unit="GiB"
          stops={stops}
          value={0.5}
          onChange={onChange}
          onValueCommit={onValueCommit}
        />
      )
    );

    let input = container.querySelector('input')!;
    expect(input.getAttribute('aria-label')).toBe('Memory (GiB)');
    expect(input.parentElement?.textContent).toBe('GiB');
    await typeValue(input, '2');
    expect(onChange).not.toHaveBeenCalled();

    let event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    });
    await act(async () => input.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalledWith(2);
    expect(onValueCommit).toHaveBeenCalledWith(2);
  });

  it('snaps typed values to enabled steps and clamps to the available range', async () => {
    let onChange = vi.fn();
    await act(async () =>
      root.render(<Slider label="CPU" stops={stops} value={2} onChange={onChange} />)
    );
    let input = container.querySelector('input')!;

    await typeValue(input, '1');
    await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    expect(onChange).toHaveBeenLastCalledWith(0.5);
    expect(input.value).toBe('0.5');

    await typeValue(input, '100');
    await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(input.value).toBe('2');
  });

  it('uses enabled steps for input arrow keys and restores an empty input', async () => {
    let onChange = vi.fn();
    await act(async () =>
      root.render(<Slider label="CPU" stops={stops} value={0.5} onChange={onChange} />)
    );
    let input = container.querySelector('input')!;
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
      )
    );
    expect(onChange).toHaveBeenCalledWith(2);
    onChange.mockClear();

    await typeValue(input, '');
    await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    expect(input.value).toBe('0.5');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not emit a change when controlled values update', async () => {
    let onChange = vi.fn();
    await act(async () =>
      root.render(<Slider label="CPU" stops={stops} value={0.5} onChange={onChange} />)
    );
    await act(async () =>
      root.render(<Slider label="CPU" stops={stops} value={2} onChange={onChange} />)
    );

    expect(container.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe(
      '2'
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
