// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dismissEditorOverlays, registerEditorOverlay, hasEditorOverlay } from '../overlays';
let cleanups: (() => void)[] = [];
let element = () => document.body.appendChild(document.createElement('button'));
let escape = () =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  );
afterEach(() => {
  cleanups.reverse().forEach(cleanup => cleanup());
  cleanups = [];
  document.body.innerHTML = '';
});
describe('editor overlay ownership', () => {
  it('replaces siblings and keeps Escape listeners working', () => {
    let first = vi.fn();
    let second = vi.fn();
    cleanups.push(registerEditorOverlay({ element, close: first }));
    cleanups.push(registerEditorOverlay({ element, close: second }));
    expect(first).toHaveBeenCalledWith('replaced');
    escape();
    expect(second).toHaveBeenCalledWith('escape');
    expect(hasEditorOverlay()).toBe(false);
  });
  it('closes a nested child before its parent, restoring focus once', () => {
    let parent = element();
    let trigger = parent.appendChild(document.createElement('button'));
    let child = element();
    let parentClose = vi.fn();
    let childClose = vi.fn();
    let focus = vi.fn();
    cleanups.push(registerEditorOverlay({ element: () => parent, close: parentClose }));
    cleanups.push(
      registerEditorOverlay({
        element: () => child,
        trigger: () => trigger,
        close: childClose,
        restoreFocus: focus
      })
    );
    escape();
    expect(childClose).toHaveBeenCalledWith('escape');
    expect(parentClose).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledTimes(1);
    escape();
    expect(parentClose).toHaveBeenCalledWith('escape');
  });
  it('ignores composing Escape and leaves native dialog Escape alone', () => {
    let close = vi.fn();
    cleanups.push(registerEditorOverlay({ element, close }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true }));
    expect(close).not.toHaveBeenCalled();
    let modalClose = vi.fn();
    cleanups.push(registerEditorOverlay({ element, close: modalClose, nativeEscape: true }));
    escape();
    expect(modalClose).not.toHaveBeenCalled();
  });
  it('outside pointer dismissal preserves destination focus and ignores owned triggers', () => {
    let popup = element();
    let trigger = element();
    let outside = element();
    let close = vi.fn();
    let restoreFocus = vi.fn();
    cleanups.push(
      registerEditorOverlay({
        element: () => popup,
        trigger: () => trigger,
        close,
        restoreFocus
      })
    );
    trigger.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(close).not.toHaveBeenCalled();
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(close).toHaveBeenCalledWith('outside');
    expect(restoreFocus).not.toHaveBeenCalled();
  });

  it('dismisses custom popups before a native dialog opens', () => {
    let close = vi.fn();
    cleanups.push(registerEditorOverlay({ element, close }));
    dismissEditorOverlays();
    expect(close).toHaveBeenCalledWith('replaced');
    expect(hasEditorOverlay()).toBe(false);
  });
});
