// @vitest-environment jsdom

import React, { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './dialog';
import { LargePanelDialog } from './largePanel';
import { Panel } from './panel';

vi.mock('../menu', () => ({ Menu: () => null }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let trigger: HTMLButtonElement;

beforeEach(() => {
  container = document.createElement('div');
  trigger = document.createElement('button');
  document.body.append(trigger, container);
  trigger.focus();
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  trigger.remove();
  vi.restoreAllMocks();
});

let wrappers = [
  { name: 'Dialog', Wrapper: Dialog.Wrapper },
  { name: 'Panel', Wrapper: Panel.Wrapper },
  { name: 'LargePanelDialog', Wrapper: LargePanelDialog.Wrapper }
];

for (let { name, Wrapper } of wrappers) {
  describe(name, () => {
    let render = async (children: React.ReactNode, isOpen = true) => {
      await act(async () => {
        root.render(
          <StrictMode>
            <Wrapper isOpen={isOpen} onOpenChange={() => {}}>
              <Dialog.Title>Test Modal</Dialog.Title>
              <Dialog.Description>Test Description</Dialog.Description>
              <Panel.Header>Header</Panel.Header>
              {children}
            </Wrapper>
          </StrictMode>
        );
      });
    };

    it('prefers the first text field over header buttons without requiring a form', async () => {
      await render(
        <>
          <input id="first" />
          <textarea id="second" />
        </>
      );
      expect(document.activeElement?.id).toBe('first');
    });

    it('skips controls that are not editable, visible, and tabbable', async () => {
      await render(
        <form>
          <input type="hidden" />
          <input type="checkbox" />
          <select>
            <option>Option</option>
          </select>
          <input disabled />
          <fieldset disabled>
            <input />
          </fieldset>
          <input readOnly />
          <input tabIndex={-1} />
          <div hidden>
            <input />
          </div>
          <div style={{ display: 'none' }}>
            <input />
          </div>
          <div style={{ visibility: 'hidden' }}>
            <input />
          </div>
          <div inert>
            <input />
          </div>
          <textarea id="eligible" />
        </form>
      );
      expect(document.activeElement?.id).toBe('eligible');
    });

    it('preserves explicit autofocus on a later field', async () => {
      await render(
        <>
          <input />
          <input id="explicit" autoFocus />
        </>
      );
      expect(document.activeElement?.id).toBe('explicit');
    });

    it('focuses a field that arrives after loading', async () => {
      await render(<span>Loading</span>);
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Close');
      await render(<input id="loaded" />);
      expect(document.activeElement?.id).toBe('loaded');
    });

    it('focuses a field that becomes enabled', async () => {
      await render(<input id="enabled" disabled />);
      await render(<input id="enabled" />);
      expect(document.activeElement?.id).toBe('enabled');
    });

    it.each(['keydown', 'pointerdown'])('does not steal focus after %s', async eventType => {
      await render(<span>Loading</span>);
      let fallback = document.activeElement;
      await act(async () => {
        fallback?.dispatchEvent(new Event(eventType, { bubbles: true }));
      });
      await render(<input id="loaded" />);
      expect(document.activeElement).toBe(fallback);
    });

    it('does not steal focus after focus moves to another control', async () => {
      await render(
        <>
          <button id="action">Action</button>
        </>
      );
      await act(async () => document.getElementById('action')?.focus());
      await render(
        <>
          <button id="action">Action</button>
          <input id="loaded" />
        </>
      );
      expect(document.activeElement?.id).toBe('action');
    });

    it('applies focus only once per opening', async () => {
      await render(<input id="original" />);
      await render(
        <>
          <input id="new" />
          <input id="original" />
        </>
      );
      expect(document.activeElement?.id).not.toBe('new');
    });

    it('does not search a nested dialog for fields', async () => {
      await render(
        <>
          <div role="dialog">
            <input id="nested" />
          </div>
          <input id="own" />
        </>
      );
      expect(document.activeElement?.id).toBe('own');
    });

    it('starts a new focus session on reopening', async () => {
      await render(<input id="first" />);
      await render(null, false);
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      trigger.focus();
      await render(<input id="reopened" />);
      expect(document.activeElement?.id).toBe('reopened');
    });

    it('disconnects observation when closed', async () => {
      let disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
      await render(<span>Loading</span>);
      let count = disconnect.mock.calls.length;
      await render(null, false);
      expect(disconnect.mock.calls.length).toBeGreaterThan(count);
    });

    it('disconnects observation when unmounted', async () => {
      let disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
      await render(<span>Loading</span>);
      let count = disconnect.mock.calls.length;
      await act(async () => root.render(null));
      expect(disconnect.mock.calls.length).toBeGreaterThan(count);
    });

    it('preserves focus in a nested portaled modal while parent fields arrive', async () => {
      let nested = (
        <Dialog.Wrapper isOpen onOpenChange={() => {}}>
          <Dialog.Title>Nested Modal</Dialog.Title>
          <Dialog.Description>Nested Description</Dialog.Description>
          <input id="nested-field" />
        </Dialog.Wrapper>
      );

      await render(
        <>
          <span>Loading</span>
          {nested}
        </>
      );
      expect(document.activeElement?.id).toBe('nested-field');
      await render(
        <>
          <input id="parent-field" />
          {nested}
        </>
      );
      expect(document.activeElement?.id).toBe('nested-field');
    });
  });
}
