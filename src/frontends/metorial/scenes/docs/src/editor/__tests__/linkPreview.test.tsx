// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkPreviewPopover } from '../LinkPreviewPopover';
import { lightTheme } from '../../styles/theme';
import { registerEditorOverlay } from '../overlays';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let editor: Editor;
let link: HTMLAnchorElement;
let move = (target: Element) =>
  act(() => {
    target.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
  });
let leave = (target: Element, next: Element | null = null) =>
  act(() => {
    target.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: next }));
  });
let advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
let preview = () => document.querySelector('[aria-label="Link preview"]');
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 100,
    bottom: 120,
    right: 200,
    width: 100,
    height: 20,
    x: 100,
    y: 100,
    toJSON: () => ({})
  });
  editor = new Editor({
    element: document.body.appendChild(document.createElement('div')),
    extensions: [StarterKit],
    content:
      '<p><a href="https://example.com">Example</a> text <a href="https://other.example">Other</a></p>'
  });
  link = editor.view.dom.querySelector('a')!;
  root = createRoot(document.body.appendChild(document.createElement('div')));
  act(() =>
    root.render(
      <ThemeProvider theme={lightTheme}>
        <LinkPreviewPopover editor={editor} />
      </ThemeProvider>
    )
  );
});
afterEach(() => {
  act(() => root.unmount());
  editor.destroy();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});
describe('link preview timing', () => {
  it('opens at 800 ms without resetting on movement, then closes after 250 ms outside', () => {
    move(link);
    advance(400);
    move(link);
    advance(399);
    expect(preview()).toBeNull();
    advance(1);
    expect(preview()).not.toBeNull();
    leave(link);
    advance(249);
    expect(preview()).not.toBeNull();
    advance(1);
    expect(preview()).toBeNull();
  });
  it('cancels opening on leave and starts a fresh delay for another link', () => {
    move(link);
    advance(700);
    leave(link);
    advance(200);
    expect(preview()).toBeNull();
    move(link);
    advance(700);
    move(editor.view.dom.querySelectorAll('a')[1]);
    advance(799);
    expect(preview()).toBeNull();
    advance(1);
    expect(preview()?.textContent).toContain('other.example');
  });
  it('supports crossing into the preview and clicking Open', () => {
    let open = vi.spyOn(window, 'open').mockImplementation(() => null);
    move(link);
    advance(800);
    leave(link);
    advance(200);
    move(preview()!);
    advance(500);
    expect(preview()).not.toBeNull();
    act(() => (preview()!.querySelector('button') as HTMLButtonElement).click());
    expect(open).toHaveBeenCalledWith('https://example.com/', '_blank', 'noopener,noreferrer');
    leave(preview()!);
    advance(250);
    expect(preview()).toBeNull();
  });
  it('Escape cancels pending and visible previews until the pointer leaves', () => {
    move(link);
    advance(500);
    act(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    );
    move(link);
    advance(1000);
    expect(preview()).toBeNull();
    leave(link);
    move(link);
    advance(800);
    expect(preview()).not.toBeNull();
    act(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    );
    move(link);
    advance(1000);
    expect(preview()).toBeNull();
  });
  it('caret movement does not open a preview and explicit overlays suppress it', () => {
    act(() => editor.commands.setTextSelection(3));
    advance(1000);
    expect(preview()).toBeNull();
    move(link);
    advance(500);
    let unregister: () => void;
    act(() => {
      unregister = registerEditorOverlay({ element: () => null, close: () => {} });
    });
    advance(1000);
    expect(preview()).toBeNull();
    unregister!();
  });
  it('keeps an open preview while keyboard focus is inside it', () => {
    move(link);
    advance(800);
    act(() => (preview()!.querySelector('button') as HTMLButtonElement).focus());
    leave(link);
    advance(500);
    expect(preview()).not.toBeNull();
    act(() => (document.activeElement as HTMLElement).blur());
    advance(250);
    expect(preview()).toBeNull();
  });
});
