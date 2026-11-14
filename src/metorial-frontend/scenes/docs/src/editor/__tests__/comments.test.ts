// @vitest-environment jsdom
import { CommentThreadMark, DocumentAnnotationAttributes } from '@metorial/docs-editor-schema';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';
import { layoutRailItems } from '../commentsLayout';
import {
  CommentHighlights,
  getCommentThreadAnchors,
  getPendingCommentRange
} from '../extensions/CommentHighlights';

let editors: Editor[] = [];

let make = (activated: string[] = []) => {
  let editor = new Editor({
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: 'b1' },
          content: [
            { type: 'text', text: 'Hello ' },
            {
              type: 'text',
              text: 'commented',
              marks: [{ type: 'commentThread', attrs: { threadId: 'doccth_open' } }]
            },
            { type: 'text', text: ' and ' },
            {
              type: 'text',
              text: 'foreign',
              marks: [{ type: 'commentThread', attrs: { threadId: 'doccth_foreign' } }]
            }
          ]
        }
      ]
    },
    extensions: [
      StarterKit,
      DocumentAnnotationAttributes,
      CommentThreadMark,
      CommentHighlights.configure({ onActivate: id => activated.push(id) })
    ]
  });
  editors.push(editor);
  return editor;
};

let highlightedThreads = (editor: Editor) =>
  [...editor.view.dom.querySelectorAll('.docs-comment-highlight')].map(element =>
    element.getAttribute('data-highlight-thread-id')
  );

afterEach(() => {
  for (let editor of editors.splice(0)) editor.destroy();
});

describe('CommentHighlights', () => {
  it('only highlights threads the client knows are open', () => {
    let editor = make();
    expect(highlightedThreads(editor)).toEqual([]);

    editor.commands.setCommentThreads(['doccth_open']);

    expect(highlightedThreads(editor)).toEqual(['doccth_open']);
    expect([...getCommentThreadAnchors(editor.state).keys()]).toEqual(['doccth_open']);
  });

  it('marks the active thread', () => {
    let editor = make();
    editor.commands.setCommentThreads(['doccth_open']);
    editor.commands.setActiveCommentThread('doccth_open');

    expect(editor.view.dom.querySelector('.docs-comment-highlight--active')?.textContent).toBe(
      'commented'
    );
  });

  it('maps the pending range through edits and drops it once collapsed', () => {
    let editor = make();
    editor.commands.setPendingComment({ from: 1, to: 6 });

    editor.commands.insertContentAt(1, 'Oh ');
    expect(getPendingCommentRange(editor.state)).toEqual({ from: 4, to: 9 });
    expect(editor.view.dom.querySelector('.docs-comment-pending')?.textContent).toBe('Hello');

    editor.commands.deleteRange({ from: 4, to: 9 });
    expect(getPendingCommentRange(editor.state)).toBeNull();
  });

  it('strips comment marks from pasted content', () => {
    (globalThis as any).ClipboardEvent ??= class extends Event {};
    let editor = make();
    editor.commands.setCommentThreads(['doccth_open']);
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    editor.view.pasteHTML(
      '<p><span data-comment-thread="true" data-thread-id="doccth_open">copied</span></p>'
    );

    let anchor = getCommentThreadAnchors(editor.state).get('doccth_open');
    expect(editor.state.doc.textBetween(anchor!.from, anchor!.to)).toBe('commented');
  });
});

describe('layoutRailItems', () => {
  it('pushes overlapping cards down', () => {
    let tops = layoutRailItems(
      [
        { id: 'a', desiredTop: 0, height: 100 },
        { id: 'b', desiredTop: 20, height: 50 },
        { id: 'c', desiredTop: 400, height: 50 }
      ],
      null,
      8
    );

    expect(Object.fromEntries(tops)).toEqual({ a: 0, b: 108, c: 400 });
  });

  it('keeps the active card aligned and moves earlier cards up', () => {
    let tops = layoutRailItems(
      [
        { id: 'a', desiredTop: 0, height: 100 },
        { id: 'b', desiredTop: 20, height: 50 },
        { id: 'c', desiredTop: 40, height: 50 }
      ],
      'b',
      8
    );

    expect(Object.fromEntries(tops)).toEqual({ a: -88, b: 20, c: 78 });
  });
});
