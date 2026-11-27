// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PluginKey } from '@tiptap/pm/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SlashCommand, SlashCommandPluginKey } from '../extensions/SlashCommand';
import { slashSuggestion } from '../slashMenuRenderer';
import { lightTheme } from '../../styles/theme';
import { BubbleMenu } from '../BubbleMenu';
import { EditorBubbleMenu } from '../EditorBubbleMenu';
import { CalloutMenu } from '../CalloutMenu';
import { TableMenu } from '../TableMenu';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let editors: Editor[] = [];
let roots: Root[] = [];
let make = () => {
  let editor = new Editor({
    element: document.body.appendChild(document.createElement('div')),
    extensions: [
      StarterKit,
      SlashCommand.configure({ suggestion: slashSuggestion(() => lightTheme) })
    ]
  });
  editors.push(editor);
  return editor;
};
let key = async (editor: Editor, key: string, shiftKey = false) => {
  await act(async () => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
    );
  });
};
beforeEach(() => {
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
  Range.prototype.getBoundingClientRect = Element.prototype.getBoundingClientRect;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Element.prototype.scrollIntoView = () => {};
});
afterEach(async () => {
  await act(async () => {
    roots.forEach(root => root.unmount());
    editors.forEach(editor => editor.destroy());
  });
  roots = [];
  editors = [];
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 180));
  });
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
describe('actual editor keyboard handling', () => {
  it('empty suggestions do not swallow Enter', async () => {
    let editor = make();
    await act(async () => {
      editor.commands.insertContent('/zz');
    });
    expect(SlashCommandPluginKey.getState(editor.state).active).toBe(true);
    await key(editor, 'Enter');
    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.firstChild?.textContent).toBe('/zz');
  });
  it('Shift+Enter inserts a hard break rather than executing a suggestion', async () => {
    let editor = make();
    await act(async () => {
      editor.commands.insertContent('/head');
    });
    await key(editor, 'Enter', true);
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(editor.state.doc.firstChild?.lastChild?.type.name).toBe('hardBreak');
  });
  it('Escape ends the session and subsequent Enter creates a paragraph', async () => {
    let editor = make();
    await act(async () => {
      editor.commands.insertContent('/head');
    });
    await key(editor, 'Escape');
    expect(SlashCommandPluginKey.getState(editor.state).active).toBe(false);
    await act(async () => {
      editor.commands.insertContent('ing');
    });
    expect(SlashCommandPluginKey.getState(editor.state).active).toBe(false);
    await key(editor, 'Enter');
    expect(editor.state.doc.childCount).toBe(2);
  });
  it('Enter executes a matching command', async () => {
    let editor = make();
    await act(async () => {
      editor.commands.insertContent('/heading');
    });
    await key(editor, 'Enter');
    expect(editor.state.doc.firstChild?.type.name).toBe('heading');
    expect(editor.state.doc.textContent).toBe('');
  });
  it('rapid dismiss/reopen removes old portal roots', async () => {
    let editor = make();
    await act(async () => {
      editor.commands.insertContent('/head');
    });
    await key(editor, 'Escape');
    await act(async () => {
      editor.commands.insertContent(' /head');
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 180));
    });
    expect(document.body.textContent?.match(/Heading 1/g)?.length).toBe(1);
  });
});
describe('local Tiptap bubble adapter', () => {
  it('shows the inline formatting menu for selected paragraph text', async () => {
    let editor = make();
    let root = createRoot(document.body.appendChild(document.createElement('div')));
    roots.push(root);
    await act(async () =>
      root.render(
        <ThemeProvider theme={lightTheme}>
          <EditorBubbleMenu editor={editor} />
          <TableMenu editor={editor} />
          <CalloutMenu editor={editor} />
        </ThemeProvider>
      )
    );
    await act(async () => {
      editor.commands.setContent('<p>Selected text</p>');
      editor.commands.setTextSelection({ from: 1, to: 9 });
    });
    let bold = document.querySelector<HTMLButtonElement>('button[title="Bold"]');
    expect(bold).not.toBeNull();
    let host = bold?.closest<HTMLElement>('[style*="visibility"]');
    expect(host?.style.visibility).toBe('visible');
  });

  it('honors show/hide metadata and remains hidden for an unchanged selection', async () => {
    let editor = make();
    let root = createRoot(document.body.appendChild(document.createElement('div')));
    roots.push(root);
    let pluginKey = new PluginKey('testBubble');
    await act(async () =>
      root.render(
        <BubbleMenu editor={editor} pluginKey={pluginKey} shouldShow={() => true}>
          <button>Test bubble</button>
        </BubbleMenu>
      )
    );
    let button = Array.from(document.querySelectorAll('button')).find(
      button => button.textContent === 'Test bubble'
    )!;
    let host = button.parentElement!.parentElement!;
    expect(host.style.visibility).toBe('visible');
    await act(async () => {
      editor.view.dispatch(editor.state.tr.setMeta(pluginKey, 'hide'));
    });
    expect(host.style.visibility).toBe('hidden');
    await act(async () => {
      editor.view.dispatch(editor.state.tr);
    });
    expect(host.style.visibility).toBe('hidden');
    await act(async () => {
      editor.view.dispatch(editor.state.tr.setMeta(pluginKey, 'show'));
    });
    expect(host.style.visibility).toBe('visible');
  });
});
