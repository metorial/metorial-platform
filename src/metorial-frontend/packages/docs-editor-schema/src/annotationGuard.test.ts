import { describe, expect, it } from 'vitest';
import { findAnnotationChangeViolations, getAddedCommentThreadIds } from './annotationGuard';
import type { AnnotationModel } from './annotations';

let model = (
  blocks: Array<[string, string[]]>,
  threadIds: string[] = []
): AnnotationModel => ({
  blocks: blocks.map(([id, editors]) => ({ id, text: id, editors })),
  comments: threadIds.map((threadId, index) => ({ threadId, from: index, to: index + 1 }))
});

let check = (before: AnnotationModel, after: AnnotationModel, known: string[] = []) =>
  findAnnotationChangeViolations({
    before,
    after,
    actorId: 'carol',
    isKnownCommentThread: threadId => known.includes(threadId)
  });

describe('findAnnotationChangeViolations', () => {
  it('allows the sender to add and promote themselves', () => {
    let before = model([['a', ['alice']]]);
    let after = model([
      ['a', ['carol', 'alice']],
      ['b', ['carol']]
    ]);

    expect(check(before, after)).toEqual([]);
  });

  it('allows existing collaborators to move between blocks on join and split', () => {
    let before = model([
      ['a', ['alice']],
      ['b', ['bob']]
    ]);
    let after = model([
      ['a', ['alice', 'bob']],
      ['c', ['alice']]
    ]);

    expect(check(before, after)).toEqual([]);
  });

  it('rejects editor ids that do not appear anywhere in the document', () => {
    let before = model([['a', ['alice']]]);
    let after = model([['a', ['alice', 'mallory']]]);

    expect(check(before, after)).toEqual([
      { type: 'unknown_editor', blockId: 'a', actorId: 'mallory' }
    ]);
  });

  it('rejects handing primary authorship of an existing block to someone else', () => {
    let before = model([['a', ['alice', 'bob']]]);
    let after = model([['a', ['bob', 'alice']]]);

    expect(check(before, after)).toEqual([
      { type: 'reassigned_primary', blockId: 'a', actorId: 'bob' }
    ]);
  });

  it('rejects comment threads the server does not know about', () => {
    let before = model([['a', ['alice']]], ['t1']);
    let after = model([['a', ['alice']]], ['t1', 't2', 't3']);

    expect(check(before, after, ['t2'])).toEqual([
      { type: 'unknown_comment_thread', threadId: 't3' }
    ]);
  });

  it('allows removing comment marks', () => {
    let before = model([['a', ['alice']]], ['t1']);
    let after = model([['a', ['alice']]]);

    expect(check(before, after)).toEqual([]);
  });
});

describe('getAddedCommentThreadIds', () => {
  it('returns each new thread id once', () => {
    let before = model([], ['t1']);
    let after: AnnotationModel = {
      blocks: [],
      comments: [
        { threadId: 't1', from: 0, to: 1 },
        { threadId: 't2', from: 1, to: 2 },
        { threadId: 't2', from: 4, to: 5 }
      ]
    };

    expect(getAddedCommentThreadIds(before, after)).toEqual(['t2']);
  });
});
