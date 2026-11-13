import { findAnnotationChangeViolations } from '@metorial/docs-editor-schema';
import { Schema, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import {
  collectBlockTouches,
  computeAttributionUpdates,
  type BlockEditStats
} from '../attribution';

let schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: {
      content: 'text*',
      attrs: { blockId: { default: null }, editors: { default: [] } }
    },
    text: {}
  }
});

let paragraph = (text: string, blockId: string | null, editors: string[]) =>
  schema.node('paragraph', { blockId, editors }, text ? schema.text(text) : undefined);

let createState = (...paragraphs: ProseMirrorNode[]) =>
  EditorState.create({ schema, doc: schema.node('doc', null, paragraphs) });

let applyAttribution = (
  state: EditorState,
  transactions: Transaction[],
  actorId: string,
  stats = new Map<string, BlockEditStats>()
) => {
  let next = transactions.reduce((current, tr) => current.apply(tr), state);
  let updates = computeAttributionUpdates({
    doc: next.doc,
    touches: collectBlockTouches(transactions),
    actorId,
    stats
  });

  let tr = next.tr;
  for (let update of updates) {
    tr.setNodeMarkup(update.pos, undefined, {
      blockId: update.blockId,
      editors: update.editors
    });
  }

  let result = next.apply(tr);
  expect(
    findAnnotationChangeViolations({
      before: { blocks: blocks(state), comments: [] },
      after: { blocks: blocks(result), comments: [] },
      actorId,
      isKnownCommentThread: () => false
    })
  ).toEqual([]);

  return result;
};

let blocks = (state: EditorState) => {
  let result: { id: string; text: string; editors: string[] }[] = [];
  state.doc.forEach(node => {
    result.push({
      id: node.attrs.blockId,
      text: node.textContent,
      editors: node.attrs.editors
    });
  });
  return result;
};

describe('editor attribution', () => {
  it('makes the creator of a new line its primary editor', () => {
    let state = createState(paragraph('Existing line', 'a', ['alice']));
    let split = state.tr.split(state.doc.content.size - 1);
    let afterSplit = applyAttribution(state, [split], 'bob');
    let typed = applyAttribution(
      afterSplit,
      [afterSplit.tr.insertText('Hi', afterSplit.doc.content.size - 1)],
      'bob'
    );

    let [first, second] = blocks(typed);
    expect(first).toEqual({ id: 'a', text: 'Existing line', editors: ['alice'] });
    expect(second!.id).not.toBe('a');
    expect(second!.editors).toEqual(['bob', 'alice']);
  });

  it('appends a small edit without changing the primary editor', () => {
    let state = createState(paragraph('A fairly long sentence here.', 'a', ['alice']));
    let next = applyAttribution(state, [state.tr.insertText('!', 28)], 'bob');

    expect(blocks(next)[0]!.editors).toEqual(['alice', 'bob']);
  });

  it('promotes an editor once they changed at least 60% of the line', () => {
    let stats = new Map<string, BlockEditStats>();
    let state = createState(paragraph('0123456789', 'a', ['alice']));

    let partial = applyAttribution(state, [state.tr.delete(1, 6)], 'bob', stats);
    expect(blocks(partial)[0]!.editors).toEqual(['alice', 'bob']);

    let rewritten = applyAttribution(partial, [partial.tr.insertText('xyz', 1)], 'bob', stats);
    expect(blocks(rewritten)[0]!.editors).toEqual(['bob', 'alice']);
  });

  it('keeps the first block and merges editor lists on join', () => {
    let state = createState(
      paragraph('First', 'a', ['alice']),
      paragraph('Second', 'b', ['carol'])
    );
    let joinPos = state.doc.firstChild!.nodeSize;
    let next = applyAttribution(state, [state.tr.join(joinPos)], 'bob');

    expect(blocks(next)).toEqual([
      { id: 'a', text: 'FirstSecond', editors: ['alice', 'carol'] }
    ]);
  });

  it('assigns fresh ids to duplicated blocks', () => {
    let state = createState(
      paragraph('One', 'a', ['alice']),
      paragraph('Two', 'a', ['alice'])
    );
    let next = applyAttribution(
      state,
      [state.tr.setSelection(TextSelection.create(state.doc, 1))],
      'bob'
    );

    let [first, second] = blocks(next);
    expect(first!.id).toBe('a');
    expect(second!.id).not.toBe('a');
    expect(second!.id).toBeTruthy();
  });

  it('attributes pasted multi-paragraph content to the paster', () => {
    let state = createState(paragraph('Intro', 'a', ['alice']));
    let slice = schema
      .node('doc', null, [
        paragraph('Pasted one', null, []),
        paragraph('Pasted two', null, [])
      ])
      .slice(0);
    let next = applyAttribution(
      state,
      [state.tr.replace(state.doc.content.size, state.doc.content.size, slice)],
      'bob'
    );

    let [intro, one, two] = blocks(next);
    expect(intro!.editors).toEqual(['alice']);
    expect(one!.editors).toEqual(['bob']);
    expect(two!.editors).toEqual(['bob']);
  });
});
