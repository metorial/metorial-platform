import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { mapLinkRange } from '../linkRange';
let schema = new Schema({
  nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'text*' }, text: {} }
});
let state = () =>
  EditorState.create({
    schema,
    doc: schema.node('doc', null, [
      schema.node('paragraph', null, schema.text('prefix link suffix'))
    ])
  });
describe('saved link targets', () => {
  it('maps a range through collaborative insertions before it', () => {
    expect(mapLinkRange({ from: 8, to: 12 }, state().tr.insertText('new ', 1))).toEqual({
      from: 12,
      to: 16
    });
  });
  it('invalidates a deleted link target', () => {
    expect(mapLinkRange({ from: 8, to: 12 }, state().tr.delete(8, 12))).toBeNull();
  });
  it('invalidates a deleted insertion point and maps an intact caret', () => {
    expect(mapLinkRange({ from: 9, to: 9 }, state().tr.delete(8, 12))).toBeNull();
    expect(mapLinkRange({ from: 9, to: 9 }, state().tr.insertText('x', 1))).toEqual({
      from: 10,
      to: 10
    });
  });
});
