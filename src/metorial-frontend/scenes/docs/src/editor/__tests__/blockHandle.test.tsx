// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type { DragHandleProps } from '@tiptap/extension-drag-handle-react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BlockHandle } from '../BlockHandle';
import { lightTheme } from '../../styles/theme';

let handleProps: DragHandleProps;
vi.mock('@tiptap/extension-drag-handle-react', async importOriginal => {
  let original = await importOriginal<typeof import('@tiptap/extension-drag-handle-react')>();
  return {
    ...original,
    DragHandle: (props: DragHandleProps) => {
      handleProps = props;
      return <original.DragHandle {...props} />;
    }
  };
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let editor: Editor;
let root: Root;
let locks: boolean[];
let button: HTMLButtonElement;

beforeEach(async () => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 100,
    y: 100,
    left: 100,
    top: 100,
    bottom: 120,
    right: 200,
    width: 100,
    height: 20,
    toJSON: () => ({})
  });
  editor = new Editor({
    element: document.body.appendChild(document.createElement('div')),
    extensions: [StarterKit],
    content: '<p>First block</p><p>Second block</p>'
  });
  locks = [];
  editor.on('transaction', ({ transaction }) => {
    let locked = transaction.getMeta('lockDragHandle');
    if (locked !== undefined) locks.push(locked);
  });
  root = createRoot(document.body.appendChild(document.createElement('div')));
  await act(async () =>
    root.render(
      <ThemeProvider theme={lightTheme}>
        <div>
          <div
            ref={element => {
              if (element) element.appendChild(editor.view.dom.parentElement!);
            }}
          />
          <BlockHandle editor={editor} />
        </div>
      </ThemeProvider>
    )
  );
  await act(async () =>
    handleProps.onNodeChange?.({
      editor,
      node: editor.state.doc.firstChild!,
      pos: 0
    })
  );
  button = document.querySelector('[data-block-handle]')!;
});

afterEach(async () => {
  await act(async () => root.unmount());
  editor.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

let mouse = async (type: string) => {
  await act(async () => button.dispatchEvent(new MouseEvent(type, { bubbles: true })));
};

it('keeps the native drag handle draggable while hovered and pressed', async () => {
  expect(editor.commands.lockDragHandle).toBeUndefined();
  let handle = button.closest('.drag-handle') as HTMLElement;
  expect(handle.draggable).toBe(true);
  await mouse('mouseover');
  expect(handle.draggable).toBe(true);
  await mouse('mousedown');
  expect(handle.draggable).toBe(true);
  await mouse('mouseout');
  expect(locks).toEqual([]);
});

it('keeps the block menu open until Escape and unlocks on dismissal', async () => {
  await mouse('mouseover');
  await mouse('mousedown');
  await mouse('mouseup');
  expect(document.body.textContent).toContain('Turn into');
  expect(button.isConnected).toBe(true);
  expect(locks).toEqual([true]);
  expect((button.closest('.drag-handle') as HTMLElement).draggable).toBe(false);
  await act(async () =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true
      })
    )
  );
  expect(locks).toEqual([true, false]);
  expect(button.style.visibility).toBe('');
  expect((button.closest('.drag-handle') as HTMLElement).draggable).toBe(true);
});

it('unlocks when the handle unmounts with its menu open', async () => {
  await mouse('mouseover');
  await mouse('mousedown');
  await mouse('mouseup');
  await act(async () => root.render(null));
  expect(locks).toEqual([true, false]);
});

it('moves a block from the menu when its icon is clicked', async () => {
  await mouse('mouseover');
  await mouse('mousedown');
  await mouse('mouseup');
  let icon = document.querySelector('[title="Move block down"] svg')!;
  await act(async () => icon.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
  expect(locks).toEqual([true]);
  await act(async () => icon.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  expect(editor.state.doc.firstChild?.textContent).toBe('Second block');
  expect(editor.state.doc.lastChild?.textContent).toBe('First block');
  expect(locks).toEqual([true, false]);
});

it('starts a heading drag from the heading and aligns its drag image', async () => {
  await act(async () => editor.commands.setContent('<h2>Heading</h2><p>Below</p>'));
  await act(async () =>
    handleProps.onNodeChange?.({
      editor,
      node: editor.state.doc.firstChild!,
      pos: 0
    })
  );
  button = document.querySelector('[data-block-handle]')!;
  let coords = vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 1, inside: 0 });
  let dataTransfer = {
    clearData: vi.fn(),
    setDragImage: vi.fn(),
    getData: () => '',
    files: []
  };
  let draggedNode = editor.view.nodeDOM(0) as HTMLElement;
  draggedNode.style.marginTop = '48px';
  await mouse('mouseover');
  await mouse('mousedown');
  expect((button.closest('.drag-handle') as HTMLElement).draggable).toBe(true);
  let start = new MouseEvent('dragstart', { bubbles: true, clientX: 95, clientY: 110 });
  Object.defineProperty(start, 'dataTransfer', { value: dataTransfer });
  await act(async () => button.dispatchEvent(start));
  let dragImage = dataTransfer.setDragImage.mock.calls[0][0] as HTMLElement;
  expect((dragImage.firstElementChild as HTMLElement).style.marginTop).toBe('0px');
  expect(draggedNode.style.marginTop).toBe('48px');
  expect(editor.view.dragging?.slice.content.firstChild?.type.name).toBe('heading');
  expect(editor.view.dragging?.slice.content.firstChild?.textContent).toBe('Heading');
  expect(editor.view.dragging?.move).toBe(true);
  expect(editor.state.doc.firstChild?.type.name).toBe('heading');
  expect(editor.state.doc.firstChild?.textContent).toBe('Heading');
  await mouse('mouseup');
  expect(document.body.textContent).not.toContain('Turn into');
});
