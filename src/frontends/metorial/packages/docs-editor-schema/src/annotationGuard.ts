import type { AnnotationModel } from './annotations';

export type AnnotationChangeViolation =
  | { type: 'unknown_editor'; blockId: string; actorId: string }
  | { type: 'reassigned_primary'; blockId: string; actorId: string }
  | { type: 'unknown_comment_thread'; threadId: string };

// Collaborators may only attribute work to themselves. Ids that already appear in the
// document stay allowed elsewhere because joins, splits and undo legitimately move them.
export let findAnnotationChangeViolations = (d: {
  before: AnnotationModel;
  after: AnnotationModel;
  actorId?: string | null;
  isKnownCommentThread: (threadId: string) => boolean;
}): AnnotationChangeViolation[] => {
  let violations: AnnotationChangeViolation[] = [];

  let knownEditors = new Set(d.before.blocks.flatMap(block => block.editors));
  let previousBlocks = new Map(
    d.before.blocks.filter(block => block.id).map(block => [block.id, block])
  );

  for (let block of d.after.blocks) {
    for (let editor of block.editors) {
      if (editor === d.actorId || knownEditors.has(editor)) continue;
      violations.push({ type: 'unknown_editor', blockId: block.id, actorId: editor });
    }

    let previous = block.id ? previousBlocks.get(block.id) : undefined;
    let primary = block.editors[0];
    let previousPrimary = previous?.editors[0];
    if (
      previous &&
      primary &&
      previousPrimary &&
      primary !== previousPrimary &&
      primary !== d.actorId
    ) {
      violations.push({ type: 'reassigned_primary', blockId: block.id, actorId: primary });
    }
  }

  for (let threadId of getAddedCommentThreadIds(d.before, d.after)) {
    if (d.isKnownCommentThread(threadId)) continue;
    violations.push({ type: 'unknown_comment_thread', threadId });
  }

  return violations;
};

export let getAddedCommentThreadIds = (before: AnnotationModel, after: AnnotationModel) => {
  let previousThreadIds = new Set(before.comments.map(comment => comment.threadId));
  return [
    ...new Set(
      after.comments
        .map(comment => comment.threadId)
        .filter(threadId => !previousThreadIds.has(threadId))
    )
  ];
};
