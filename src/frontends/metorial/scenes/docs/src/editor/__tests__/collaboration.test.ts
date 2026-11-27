// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { HeadingWithId } from '../extensions/HeadingWithId';

let editors: Editor[] = [];

let make = () => {
  let ydoc = new Y.Doc();
  let editor = new Editor({
    extensions: [
      StarterKit.configure({ heading: false, undoRedo: false }),
      HeadingWithId.configure({ levels: [1, 2, 3] }),
      Collaboration.configure({ document: ydoc, field: 'body' })
    ]
  });
  editors.push(editor);
  return { editor, ydoc };
};

afterEach(() => {
  editors.forEach(editor => editor.destroy());
  editors = [];
});

describe('collaborative editing', () => {
  it('keeps Yjs in sync when a text edit triggers an appended structural transaction', () => {
    let { editor, ydoc } = make();
    editor.commands.setNode('heading', { level: 1 });

    let view = editor.view;
    expect(() => view.dispatch(view.state.tr.insertText('Hello', 1))).not.toThrow();

    expect(editor.state.doc.firstChild?.attrs.id).toBe('hello');
    expect(ydoc.getXmlFragment('body').toString()).toContain('Hello');
  });
});
