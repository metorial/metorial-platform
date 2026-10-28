import {
  getAnnotationsBlockEditors,
  readStoredAnnotations,
  withCommentAnchor,
  yjsUpdateToDocumentBody,
  type DocumentBody
} from '@metorial/docs-editor-schema';
import { describe, expect, it } from 'vitest';
import {
  buildLiveStateFromStoredBody,
  reconcileStoredDocumentBody,
  repairStoredDocumentBody,
  resolveDocumentDraftBody
} from './documentBody';
import { withHeadlessDom } from './headlessDom';

let title = 'Doc';
let compose = (...paragraphs: string[]) => [`# ${title}`, ...paragraphs].join('\n\n');

let expectVerified = (body: DocumentBody) => {
  let stored = readStoredAnnotations(body);
  expect(stored.status).toBe('verified');
  return stored.annotations!;
};

let editorsOf = (body: DocumentBody) => getAnnotationsBlockEditors(expectVerified(body));

let createBody = (content: string, actorId: string) =>
  reconcileStoredDocumentBody({
    previous: null,
    next: { title, content },
    actorIds: [actorId]
  });

let editBody = (previous: DocumentBody, content: string, actorIds: string[]) =>
  reconcileStoredDocumentBody({
    previous: { title, content: previous.content, annotations: previous.annotations },
    next: { title, content },
    actorIds
  });

let flushLiveState = (body: DocumentBody) =>
  yjsUpdateToDocumentBody(
    buildLiveStateFromStoredBody({
      title,
      content: body.content,
      annotations: body.annotations
    })!,
    { title }
  ).body;

describe('withHeadlessDom', () => {
  it('only exposes DOM globals while the callback runs', () => {
    expect(typeof (globalThis as any).document).toBe('undefined');

    let insideType = withHeadlessDom(() => typeof (globalThis as any).document);

    expect(insideType).toBe('object');
    expect(typeof (globalThis as any).document).toBe('undefined');
    expect(typeof (globalThis as any).DOMParser).toBe('undefined');
  });

  it('rejects async callbacks', () => {
    expect(() => withHeadlessDom(async () => 1)).toThrow(/synchronous/);
  });
});

describe('document body writers', () => {
  it('createDocument attributes every block to the creator', () => {
    let body = createBody(compose('First paragraph.', 'Second paragraph.'), 'actor_a');

    expect(editorsOf(body)).toEqual([['actor_a'], ['actor_a']]);
  });

  it('updateDocument keeps untouched blocks and applies the primary threshold', () => {
    let created = createBody(
      compose(
        'A stable paragraph.',
        'A paragraph that will be rewritten.',
        'Nearly the same.'
      ),
      'actor_a'
    );

    let edited = editBody(
      created,
      compose('A stable paragraph.', 'Completely different words here.', 'Nearly the same!'),
      ['actor_b']
    );

    expect(editorsOf(edited)).toEqual([
      ['actor_a'],
      ['actor_b', 'actor_a'],
      ['actor_a', 'actor_b']
    ]);
  });

  it('privileged writers without an actor keep existing attribution', () => {
    let created = createBody(compose('Kept paragraph.', 'Changed paragraph.'), 'actor_a');

    let synced = editBody(
      created,
      compose('Kept paragraph.', 'Changed paragraph, synced.'),
      []
    );

    expect(editorsOf(synced)).toEqual([['actor_a'], ['actor_a']]);
  });

  it('collaboration flush derives a verified pair from the live state', () => {
    let created = createBody(compose('One.', 'Two.'), 'actor_a');
    let edited = editBody(created, compose('One.', 'Two.', 'Three.'), ['actor_b']);

    let flushed = flushLiveState(edited);

    expect(editorsOf(flushed)).toEqual([['actor_a'], ['actor_a'], ['actor_b']]);
    expect(flushLiveState(flushed)).toEqual(flushed);
  });

  it('comment anchors survive seeding and flushing', () => {
    let created = createBody(compose('Comment on this sentence.'), 'actor_a');
    let commented = withCommentAnchor(created, {
      threadId: 'doccth_1',
      anchor: {
        startBlockId: expectVerified(created).blocks[0]!.id,
        startOffset: 11,
        endBlockId: expectVerified(created).blocks[0]!.id,
        endOffset: 15,
        quote: 'this'
      }
    });

    let flushed = flushLiveState(commented!);

    expect(flushed.content).toBe(created.content);
    expect(expectVerified(flushed).comments).toEqual([
      { t: 'doccth_1', s: [0, 11], e: [0, 15], q: 'this' }
    ]);
  });

  it('seeding with stale annotations only reuses blocks whose text still matches', () => {
    let created = createBody(compose('Unchanged.', 'Will change.'), 'actor_a');

    let flushed = flushLiveState({
      ...created,
      content: compose('Unchanged.', 'Changed outside the pair.')
    });

    expect(editorsOf(flushed)).toEqual([['actor_a'], []]);
  });
});

describe('repairStoredDocumentBody', () => {
  it('attributes legacy content without annotations to the creator', () => {
    let content = compose('Legacy one.', 'Legacy two.');

    let repaired = repairStoredDocumentBody({
      title,
      content,
      annotations: null,
      creatorId: 'actor_a'
    });

    expect(repaired.content).toBe(content);
    expect(editorsOf(repaired)).toEqual([['actor_a'], ['actor_a']]);
  });

  it('rebinds mismatched annotations, keeping only blocks whose text still matches', () => {
    let created = createBody(compose('Unchanged.', 'Will change.'), 'actor_a');
    let content = compose('Unchanged.', 'Changed outside the pair.');

    let repaired = repairStoredDocumentBody({
      title,
      content,
      annotations: created.annotations,
      creatorId: 'actor_z'
    });

    expect(editorsOf(repaired)).toEqual([['actor_a'], []]);
  });

  it('treats malformed annotations like missing ones', () => {
    let repaired = repairStoredDocumentBody({
      title,
      content: compose('Text.'),
      annotations: { v: 99 },
      creatorId: 'actor_a'
    });

    expect(editorsOf(repaired)).toEqual([['actor_a']]);
  });
});

describe('resolveDocumentDraftBody', () => {
  it('uses verified draft annotations as-is', () => {
    let stored = createBody(compose('Stored.'), 'actor_a');
    let draft = editBody(stored, compose('Stored.', 'Drafted.'), ['actor_b']);

    let resolved = resolveDocumentDraftBody({
      draft: { title, content: draft.content, annotations: draft.annotations },
      stored: { title, content: stored.content, annotations: stored.annotations },
      actorIds: ['actor_c']
    });

    expect(editorsOf(resolved)).toEqual([['actor_a'], ['actor_b']]);
  });

  it('reconciles legacy drafts without annotations against the stored pair', () => {
    let stored = createBody(compose('Stored.'), 'actor_a');

    let resolved = resolveDocumentDraftBody({
      draft: { title, content: compose('Stored.', 'Legacy draft.') },
      stored: { title, content: stored.content, annotations: stored.annotations },
      actorIds: ['actor_c']
    });

    expect(editorsOf(resolved)).toEqual([['actor_a'], ['actor_c']]);
  });
});
