// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { initProseMirrorDoc, updateYFragment } from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import {
  applyCommentAnchorToYjsUpdate,
  buildHeadlessExtensions,
  collectTextblocks,
  decodeYjsUpdate,
  encodeYjsUpdate,
  getAnnotationsBlockEditors,
  getChangeRatio,
  getDocumentBodyMarkdown,
  getTextblockTexts,
  hashText,
  markdownToYjsUpdate,
  readStoredAnnotations,
  reconcileDocumentBody,
  removeCommentAnchorFromYjsUpdate,
  withCommentAnchor,
  yjsUpdateToDocumentBody,
  yjsUpdateToMarkdown,
  type DocumentBody
} from './index';

let title = 'Doc';

let fixtureCorpus = [
  ['Intro paragraph with **bold** text.', '', '## Section', '', 'Second paragraph.'].join(
    '\n'
  ),
  ['- One', '- Two', '  - Nested', '', '1. First', '2. Second'].join('\n'),
  ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n'),
  ['<info>', '', 'Inside callout', '', '</info>', '', 'After callout'].join('\n'),
  ['```ts', 'let a = 1;', 'let b = 2;', '```', '', 'Text after code'].join('\n'),
  ['- [ ] Task one', '- [x] Task two', '', '> Quoted line'].join('\n')
];

let compose = (body: string, frontMatter?: string) =>
  [frontMatter ? `---\n${frontMatter}\n---` : null, `# ${title}`, body]
    .filter(Boolean)
    .join('\n\n');

let createBody = (content: string, actorIds: string[]) =>
  reconcileDocumentBody({ previous: null, next: { content, title }, actorIds });

let editBody = (previous: DocumentBody, content: string, actorIds: string[]) =>
  reconcileDocumentBody({
    previous: { content: previous.content, title, annotations: previous.annotations },
    next: { content, title },
    actorIds
  });

let seed = (body: DocumentBody) => {
  let markdown = getDocumentBodyMarkdown({ content: body.content, title }).body;
  return markdownToYjsUpdate(markdown, undefined, body.annotations)!;
};

let flush = (update: string, frontMatter?: string) =>
  yjsUpdateToDocumentBody(update, { title, frontMatter }).body;

let schema = getSchema(buildHeadlessExtensions());

let editYDoc = (ydoc: Y.Doc, edit: (state: EditorState) => EditorState['tr'] | null) => {
  let fragment = ydoc.getXmlFragment('body');
  let { doc, meta } = initProseMirrorDoc(fragment, schema);
  let tr = edit(EditorState.create({ doc }));
  if (tr?.docChanged) updateYFragment(ydoc, fragment, tr.doc, meta);
};

let createRandom = (seedValue: number) => {
  let state = seedValue;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

describe('document annotations', () => {
  it('keeps markdown byte-identical when comment marks are present', () => {
    let body = createBody(compose('Hello world, this is commented.'), ['actor_a']);
    let block = body.annotations.blocks[0]!;
    let commented = withCommentAnchor(body, {
      threadId: 'thread_1',
      anchor: {
        startBlockId: block.id,
        startOffset: 6,
        endBlockId: block.id,
        endOffset: 11,
        quote: 'world'
      }
    })!;

    let update = seed(commented);

    expect(yjsUpdateToMarkdown(update)).toBe('Hello world, this is commented.');
    expect(flush(update).annotations.comments).toEqual([
      { t: 'thread_1', s: [0, 6], e: [0, 11], q: 'world' }
    ]);
  });

  it('round-trips content and annotations through seed and flush for the fixture corpus', () => {
    for (let markdown of fixtureCorpus) {
      let content = compose(markdown, 'name: test');
      let body = createBody(content, ['actor_a']);
      let normalized = flush(seed(body), 'name: test');
      let flushed = flush(seed(normalized), 'name: test');

      expect(readStoredAnnotations(normalized).status).toBe('verified');
      expect(flushed.content).toBe(normalized.content);
      expect(flushed.annotations).toEqual(normalized.annotations);
      expect(
        getAnnotationsBlockEditors(flushed.annotations).every(e => e[0] === 'actor_a')
      ).toBe(true);
    }
  });

  it('assigns the creator as primary editor of every block', () => {
    let body = createBody(compose(fixtureCorpus[0]!), ['actor_a']);

    expect(body.annotations.actors).toEqual(['actor_a']);
    expect(getAnnotationsBlockEditors(body.annotations).every(e => e[0] === 'actor_a')).toBe(
      true
    );
  });

  it('applies the primary editor threshold to external edits', () => {
    let created = createBody(
      compose(
        ['A fairly long first line of text.', '', 'Second line stays the same.'].join('\n')
      ),
      ['actor_a']
    );

    let smallEdit = editBody(
      created,
      compose(
        ['A fairly long first line of text!', '', 'Second line stays the same.'].join('\n')
      ),
      ['actor_b']
    );
    expect(getAnnotationsBlockEditors(smallEdit.annotations)).toEqual([
      ['actor_a', 'actor_b'],
      ['actor_a']
    ]);

    let largeEdit = editBody(
      smallEdit,
      compose(
        ['Completely rewritten by someone.', '', 'Second line stays the same.'].join('\n')
      ),
      ['actor_c']
    );
    expect(getAnnotationsBlockEditors(largeEdit.annotations)).toEqual([
      ['actor_c', 'actor_a', 'actor_b'],
      ['actor_a']
    ]);

    let inserted = editBody(
      largeEdit,
      compose(
        [
          'Completely rewritten by someone.',
          '',
          'A brand new line.',
          '',
          'Second line stays the same.'
        ].join('\n')
      ),
      ['actor_d']
    );
    expect(getAnnotationsBlockEditors(inserted.annotations)).toEqual([
      ['actor_c', 'actor_a', 'actor_b'],
      ['actor_d'],
      ['actor_a']
    ]);
    expect(inserted.annotations.blocks[0]!.id).toBe(created.annotations.blocks[0]!.id);
    expect(inserted.annotations.blocks[2]!.id).toBe(created.annotations.blocks[1]!.id);
  });

  it('re-anchors comments through edits and drops them when the text is gone', () => {
    let created = createBody(
      compose(['First paragraph.', '', 'Keep this phrase here.'].join('\n')),
      ['actor_a']
    );
    let block = created.annotations.blocks[1]!;
    let commented = withCommentAnchor(created, {
      threadId: 'thread_1',
      anchor: {
        startBlockId: block.id,
        startOffset: 5,
        endBlockId: block.id,
        endOffset: 16,
        quote: 'this phrase'
      }
    })!;

    let moved = editBody(
      commented,
      compose(
        ['New opening.', '', 'First paragraph.', '', 'Please keep this phrase here.'].join(
          '\n'
        )
      ),
      ['actor_b']
    );
    expect(moved.annotations.comments).toEqual([
      { t: 'thread_1', s: [2, 12], e: [2, 23], q: 'this phrase' }
    ]);

    let removed = editBody(moved, compose(['New opening.', '', 'Nothing left.'].join('\n')), [
      'actor_b'
    ]);
    expect(removed.annotations.comments).toEqual([]);
  });

  it('only applies annotations to blocks whose text hash still matches', () => {
    let body = createBody(compose(['Alpha line.', '', 'Beta line.'].join('\n')), ['actor_a']);
    let drifted = {
      ...body,
      content: compose(['Alpha line.', '', 'Beta line changed elsewhere.'].join('\n'))
    } as DocumentBody;

    expect(readStoredAnnotations(drifted).status).toBe('mismatch');

    let flushed = flush(seed(drifted));
    expect(getAnnotationsBlockEditors(flushed.annotations)).toEqual([['actor_a'], []]);
  });

  it('adds and removes comment marks on live Yjs state', () => {
    let body = createBody(compose('Comment on this sentence please.'), ['actor_a']);
    let update = seed(body);
    let blockId = body.annotations.blocks[0]!.id;

    let added = applyCommentAnchorToYjsUpdate({
      stateUpdate: update,
      threadId: 'thread_1',
      anchor: {
        startBlockId: blockId,
        startOffset: 11,
        endBlockId: blockId,
        endOffset: 24,
        quote: 'this sentence'
      }
    });
    expect(added?.quote).toBe('this sentence');

    let ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, decodeYjsUpdate(update));
    Y.applyUpdate(ydoc, decodeYjsUpdate(added!.update));
    let withComment = encodeYjsUpdate(Y.encodeStateAsUpdate(ydoc));

    expect(flush(withComment).annotations.comments).toEqual([
      { t: 'thread_1', s: [0, 11], e: [0, 24], q: 'this sentence' }
    ]);
    expect(flush(withComment).content).toBe(body.content);

    let removed = removeCommentAnchorFromYjsUpdate({
      stateUpdate: withComment,
      threadId: 'thread_1'
    });
    Y.applyUpdate(ydoc, decodeYjsUpdate(removed!.update));

    expect(flush(encodeYjsUpdate(Y.encodeStateAsUpdate(ydoc))).annotations.comments).toEqual(
      []
    );
  });

  it('falls back to quote search when the anchor offsets are stale', () => {
    let body = createBody(compose('Find the needle in here.'), ['actor_a']);
    let blockId = body.annotations.blocks[0]!.id;

    let added = applyCommentAnchorToYjsUpdate({
      stateUpdate: seed(body),
      threadId: 'thread_1',
      anchor: {
        startBlockId: blockId,
        startOffset: 0,
        endBlockId: blockId,
        endOffset: 6,
        quote: 'needle'
      }
    });

    expect(added?.quote).toBe('needle');
    expect(
      applyCommentAnchorToYjsUpdate({
        stateUpdate: seed(body),
        threadId: 'thread_2',
        anchor: {
          startBlockId: blockId,
          startOffset: 0,
          endBlockId: blockId,
          endOffset: 4,
          quote: 'missing'
        }
      })
    ).toBeNull();
  });

  it('measures change ratio on characters', () => {
    expect(getChangeRatio('abc', 'abc')).toBe(0);
    expect(getChangeRatio('hello world', 'hello world!')).toBeLessThan(0.1);
    expect(getChangeRatio('hello world', 'something else')).toBeGreaterThan(0.6);
    expect(getChangeRatio('', 'new')).toBe(1);
  });

  it('keeps the pair consistent across random concurrent edits, flushes and re-seeds', () => {
    let random = createRandom(42);
    let words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];

    for (let round = 0; round < 15; round++) {
      let body = createBody(compose(fixtureCorpus[round % fixtureCorpus.length]!), [
        'actor_a'
      ]);
      let clientA = new Y.Doc();
      let clientB = new Y.Doc();
      Y.applyUpdate(clientA, decodeYjsUpdate(seed(body)));
      Y.applyUpdate(clientB, Y.encodeStateAsUpdate(clientA));

      for (let step = 0; step < 8; step++) {
        let client = random() < 0.5 ? clientA : clientB;

        editYDoc(client, state => {
          let textblocks = collectTextblocks(state.doc);
          let target = textblocks[Math.floor(random() * textblocks.length)];
          if (!target) return null;

          let word = words[Math.floor(random() * words.length)]!;
          let tr = state.tr;
          if (random() < 0.7 || target.node.content.size === 0) {
            tr.insertText(` ${word}`, target.pos + 1 + target.node.content.size);
          } else {
            tr.delete(target.pos + 1, target.pos + 1 + Math.min(3, target.node.content.size));
          }

          return tr;
        });

        Y.applyUpdate(clientA, Y.encodeStateAsUpdate(clientB));
        Y.applyUpdate(clientB, Y.encodeStateAsUpdate(clientA));
      }

      let first = flush(encodeYjsUpdate(Y.encodeStateAsUpdate(clientA)));
      let second = flush(seed(first));
      let third = flush(seed(second));

      let markdown = getDocumentBodyMarkdown({ content: second.content, title }).body;
      let reparsedUpdate = markdownToYjsUpdate(markdown);
      let reparsed = new Y.Doc();
      if (reparsedUpdate) Y.applyUpdate(reparsed, decodeYjsUpdate(reparsedUpdate));
      let { doc } = initProseMirrorDoc(reparsed.getXmlFragment('body'), schema);

      for (let pair of [first, second, third]) {
        expect(readStoredAnnotations(pair).status).toBe('verified');
        expect(pair.annotations.contentHash).toBe(hashText(pair.content));
      }

      expect(second.annotations.blocks.length).toBe(getTextblockTexts(doc).length);
      expect(third.content).toBe(second.content);
      expect(third.annotations).toEqual(second.annotations);

      let firstEditorsByHash = new Map(
        first.annotations.blocks.map((block, index) => [
          block.h,
          getAnnotationsBlockEditors(first.annotations)[index]
        ])
      );
      second.annotations.blocks.forEach((block, index) => {
        let editors = firstEditorsByHash.get(block.h);
        if (editors)
          expect(getAnnotationsBlockEditors(second.annotations)[index]).toEqual(editors);
      });
    }
  });
});
