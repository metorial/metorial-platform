// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from '../dialog';
import { Select } from './index';

vi.mock('../menu', () => ({ Menu: () => null }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

let Harness = () => {
  let [isOpen, setIsOpen] = useState(true);
  let [value, setValue] = useState('outgoing');

  return (
    <Dialog.Wrapper isOpen={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Title>Add Network Rule</Dialog.Title>
      <Dialog.Description>Choose the traffic this rule matches.</Dialog.Description>
      <div style={{ transform: 'translateX(0)', overflow: 'hidden' }}>
        <Select
          label="Traffic"
          value={value}
          onChange={setValue}
          items={[
            { id: 'outgoing', label: 'Outgoing' },
            { id: 'incoming', label: 'Incoming' }
          ]}
        />
      </div>
    </Dialog.Wrapper>
  );
};

describe('Select inside a scrolling dialog', () => {
  it('portals outside the dialog and selects options without closing the dialog', async () => {
    await act(async () => root.render(<Harness />));
    let trigger = document.querySelector('[role="combobox"]')!;
    await act(async () =>
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    );

    let dialog = document.querySelector('[role="dialog"]')!;
    let dropdown = document.querySelector('[data-metorial-select-content]')!;
    expect(dropdown).not.toBeNull();
    expect(dialog.contains(dropdown)).toBe(false);
    expect(document.body.contains(dropdown)).toBe(true);

    let option = [...document.querySelectorAll('[role="option"]')].find(
      option => option.textContent === 'Incoming'
    )!;
    await act(async () =>
      option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    );
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="combobox"]')?.textContent).toContain('Incoming');
    expect(document.querySelector('[data-metorial-select-content]')).toBeNull();
  });
});
