// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { afterEach, describe, expect, it } from 'vitest';
import { Callout } from '../extensions/Callout';
import { CustomTable } from '../extensions/CustomTable';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { SlashCommand } from '../extensions/SlashCommand';
import { slashSuggestion } from '../slashMenuRenderer';
import { lightTheme } from '../../styles/theme';
let editors: Editor[] = [];
let make = (content: string) => {
  let editor = new Editor({
    content,
    extensions: [
      StarterKit,
      Callout,
      CustomTable,
      TableRow,
      TableCell.extend({ content: 'paragraph' }),
      TableHeader.extend({ content: 'paragraph' }),
      Markdown.configure({ html: true, breaks: false }),
      SlashCommand.configure({
        suggestion: { ...slashSuggestion(() => lightTheme), render: () => ({}) }
      })
    ]
  });
  editors.push(editor);
  return editor;
};
afterEach(() => {
  editors.forEach(editor => editor.destroy());
  editors = [];
});
describe('content and newline preservation', () => {
  it.each([
    '<p>text</p>',
    '<h2>text</h2>',
    '<ul><li><p>text</p></li></ul>',
    '<div data-type="callout" data-callout-type="info"><p>text</p></div>',
    '<table><tbody><tr><td><p>text</p></td></tr></tbody></table>'
  ])('Shift+Enter remains a hard break in %s', content => {
    let editor = make(content);
    let position = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText) position = pos + node.nodeSize;
    });
    editor.commands.setTextSelection(position);
    editor.commands.keyboardShortcut('Shift-Enter');
    let breaks = 0;
    editor.state.doc.descendants(node => {
      if (node.type.name === 'hardBreak') breaks++;
    });
    expect(breaks).toBe(1);
  });
  it('Enter in code remains a newline', () => {
    let editor = make('<pre><code>text</code></pre>');
    editor.commands.setTextSelection(5);
    editor.commands.keyboardShortcut('Enter');
    expect(editor.state.doc.firstChild?.type.name).toBe('codeBlock');
    expect(editor.state.doc.textContent).toBe('text\n');
  });
  it('paragraphs and hard breaks survive Markdown round-trip and undo/redo', () => {
    let editor = make('<p>first</p>');
    editor.commands.setTextSelection(6);
    editor.commands.keyboardShortcut('Shift-Enter');
    editor.commands.insertContent('second');
    editor.commands.keyboardShortcut('Enter');
    editor.commands.insertContent('third');
    let expected = editor.getJSON();
    let markdown = (editor.storage as any).markdown.getMarkdown();
    expect(make(markdown).getJSON()).toEqual(expected);
    editor.commands.undo();
    editor.commands.redo();
    expect(editor.getJSON()).toEqual(expected);
  });
});
