import { db } from '@metorial/db';
import {
  findAnnotationChangeViolations,
  getAddedCommentThreadIds,
  getYjsBodyAnnotationModel,
  type AnnotationChangeViolation,
  type AnnotationModel
} from '@metorial/docs-editor-schema';

let maxCachedModels = 200;
let modelCache = new Map<string, { state: string; model: AnnotationModel }>();

let emptyModel: AnnotationModel = { blocks: [], comments: [] };

let getModel = (documentId: string, state: string | null) => {
  if (!state) return emptyModel;

  let cached = modelCache.get(documentId);
  if (cached?.state === state) return cached.model;

  return getYjsBodyAnnotationModel(state);
};

let cacheModel = (documentId: string, state: string, model: AnnotationModel) => {
  modelCache.delete(documentId);
  modelCache.set(documentId, { state, model });

  if (modelCache.size > maxCachedModels) {
    let oldest = modelCache.keys().next().value;
    if (oldest) modelCache.delete(oldest);
  }
};

export let findLiveAnnotationViolations = async (d: {
  document: { id: string; oid: bigint };
  actorId?: string | null;
  previous: string | null;
  next: string;
}): Promise<AnnotationChangeViolation[]> => {
  let before = getModel(d.document.id, d.previous);
  let after = getYjsBodyAnnotationModel(d.next);

  let addedThreadIds = getAddedCommentThreadIds(before, after);
  let knownThreadIds = new Set<string>();
  if (addedThreadIds.length > 0) {
    let threads = await db.documentCommentThread.findMany({
      where: {
        id: { in: addedThreadIds },
        documentOid: d.document.oid,
        deletedAt: null
      },
      select: { id: true }
    });
    knownThreadIds = new Set(threads.map(thread => thread.id));
  }

  let violations = findAnnotationChangeViolations({
    before,
    after,
    actorId: d.actorId,
    isKnownCommentThread: threadId => knownThreadIds.has(threadId)
  });

  if (violations.length === 0) cacheModel(d.document.id, d.next, after);

  return violations;
};
