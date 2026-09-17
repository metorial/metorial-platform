// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SlashCommand,
  SlashCommandPluginKey,
  dismissSlash,
  slashSessionKey
} from '../extensions/SlashCommand';
import { slashSuggestion } from '../slashMenuRenderer';
import { lightTheme } from '../../styles/theme';

let editors: Editor[] = [];
let makeEditor = (content = '<p></p>') => {
  let editor = new Editor({
    element: document.body.appendChild(document.createElement('div')),
    content,
    extensions: [
      StarterKit,
      SlashCommand.configure({
        suggestion: {
          ...slashSuggestion(() => lightTheme),
          render: () => ({})
        }
      })
    ]
  });
  editors.push(editor);
  return editor;
};
let type = (editor: Editor, text: string) => editor.commands.insertContent(text);
let active = (editor: Editor) => SlashCommandPluginKey.getState(editor.state).active;
afterEach(() => {
  editors.forEach(editor => editor.destroy());
  editors = [];
  document.body.innerHTML = '';
});

describe('slash sessions', () => {
  it.each(['http:/', 'https:/', 'https://example.com/a/b', 'some/path', 'word/text'])(
    'does not open in %s',
    text => {
      let editor = makeEditor();
      for (let char of text) type(editor, char);
      expect(active(editor)).toBe(false);
    }
  );
  it('allows commands after a URL and across formatting boundaries', () => {
    let editor = makeEditor('<p>https:<strong>//example.com/</strong></p>');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    type(editor, 'path');
    expect(active(editor)).toBe(false);
    type(editor, ' /head');
    expect(active(editor)).toBe(true);
  });
  it('closes after three additional unmatched characters, and stays dismissed', () => {
    let editor = makeEditor();
    type(editor, '/zz');
    expect(active(editor)).toBe(true);
    type(editor, 'a');
    type(editor, 'b');
    expect(active(editor)).toBe(true);
    type(editor, 'c');
    expect(active(editor)).toBe(false);
    type(editor, 'd');
    expect(active(editor)).toBe(false);
    type(editor, ' /head');
    expect(active(editor)).toBe(true);
  });
  it('counts pasted additions and recovers matching results after backspacing', () => {
    let editor = makeEditor();
    type(editor, '/headzz');
    let to = editor.state.selection.from;
    editor.commands.deleteRange({ from: to - 2, to });
    expect(slashSessionKey.getState(editor.state)?.emptyStart).toBeNull();
    type(editor, 'zz');
    type(editor, 'abc');
    expect(active(editor)).toBe(false);
  });
  it('maps dismissal through edits before the trigger and permits a new session after leaving', () => {
    let editor = makeEditor();
    type(editor, 'prefix ');
    type(editor, '/head');
    dismissSlash(editor.view);
    editor.view.dispatch(editor.state.tr.insertText('x', 1));
    type(editor, 'ing');
    expect(active(editor)).toBe(false);
    editor.commands.setTextSelection(1);
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    expect(active(editor)).toBe(true);
  });
  it('does not activate inside code or read-only editors', () => {
    let editor = makeEditor('<pre><code></code></pre>');
    type(editor, '/head');
    expect(active(editor)).toBe(false);
    editor.commands.setContent('<p><code>code</code></p>');
    editor.commands.setTextSelection(3);
    type(editor, '/');
    expect(active(editor)).toBe(false);
    editor.commands.setContent('<p></p>');
    editor.setEditable(false);
    type(editor, '/head');
    expect(active(editor)).toBe(false);
  });
  it('does not close during an unfinished composition', () => {
    let editor = makeEditor();
    type(editor, '/zz');
    let composing = vi.spyOn(editor.view, 'composing', 'get').mockReturnValue(true);
    type(editor, 'abcd');
    expect(active(editor)).toBe(true);
    composing.mockReturnValue(false);
    editor.view.dispatch(editor.state.tr);
    expect(active(editor)).toBe(false);
  });
});
