import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CallbackCompactMultiSelect, CallbackMaskedValue } from './callbackFields';

let root: Root | null = null;

let render = async (node: React.ReactNode) => {
  let container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root!.render(node);
  });

  return container;
};

let click = async (element: HTMLElement) => {
  await act(async () => {
    element.click();
  });
};

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = null;
  }
});

describe('CallbackMaskedValue', () => {
  it('renders a masked preformatted value without copy interaction semantics', async () => {
    let container = await render(
      <CallbackMaskedValue label="Secure callback URL" value="https://example.test/••••••••" />
    );
    let value = container.querySelector('pre')!;

    expect(value.textContent).toBe('https://example.test/••••••••');
    expect(container.textContent).toContain('Secure callback URL');
    expect(container.querySelector('[role="button"]')).toBeNull();
    expect(value.tabIndex).toBe(-1);
  });
});

describe('CallbackCompactMultiSelect', () => {
  let items = [
    { id: 'issue.closed', label: 'Issue closed' },
    { id: 'issue.reopened', label: 'Issue reopened' },
    { id: 'issue.labeled', label: 'Issue labeled' }
  ];

  it('shows a compact summary and emits selection changes', async () => {
    let onChange = vi.fn();
    let Harness = () => {
      let [value, setValue] = useState(['issue.closed']);

      return (
        <CallbackCompactMultiSelect
          label="Event types"
          placeholder="Select event types"
          value={value}
          summary={`${value.length} of ${items.length} selected`}
          onChange={nextValue => {
            onChange(nextValue);
            setValue(nextValue);
          }}
          items={items}
        />
      );
    };

    let container = await render(<Harness />);
    let trigger = container.querySelector(
      'button[aria-label="Event types"]'
    ) as HTMLButtonElement;

    expect(trigger.textContent).toContain('1 of 3 selected');
    expect(trigger.textContent).not.toContain('Issue closed');

    await click(trigger);
    let checkboxes = Array.from(
      document.querySelectorAll('[role="checkbox"]')
    ) as HTMLButtonElement[];
    expect(checkboxes).toHaveLength(3);

    await click(checkboxes[1]!);

    expect(onChange).toHaveBeenLastCalledWith(['issue.closed', 'issue.reopened']);
    expect(trigger.textContent).toContain('2 of 3 selected');
  });

  it('does not open or emit changes when disabled', async () => {
    let onChange = vi.fn();
    let container = await render(
      <CallbackCompactMultiSelect
        label="Event types"
        placeholder="Select event types"
        value={['issue.closed']}
        summary="1 of 3 selected"
        disabled
        onChange={onChange}
        items={items}
      />
    );
    let trigger = container.querySelector(
      'button[aria-label="Event types"]'
    ) as HTMLButtonElement;

    expect(trigger.disabled).toBe(true);
    await click(trigger);

    expect(
      document.querySelector('[role="group"][aria-label="Event types options"]')
    ).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
