import {
  getDocumentBodyMarkdown,
  markdownToYjsUpdate,
  readStoredAnnotations,
  reconcileDocumentBody,
  type DocumentBody
} from '@metorial/docs-editor-schema';

export let reconcileStoredDocumentBody = (
  d: Parameters<typeof reconcileDocumentBody>[0]
): DocumentBody => reconcileDocumentBody(d);

export let resolveDocumentDraftBody = (d: {
  draft: { title: string; content: string; annotations?: unknown };
  stored: { title: string; content: string; annotations: unknown };
  actorIds: string[];
}): DocumentBody => {
  let draftAnnotations = readStoredAnnotations({
    content: d.draft.content,
    annotations: d.draft.annotations
  });
  if (draftAnnotations.status === 'verified') {
    return reconcileStoredDocumentBody({
      previous: { ...d.draft, annotations: draftAnnotations.annotations },
      next: d.draft,
      actorIds: []
    });
  }

  return reconcileStoredDocumentBody({
    previous: d.stored,
    next: { title: d.draft.title, content: d.draft.content },
    actorIds: d.actorIds
  });
};

export let repairStoredDocumentBody = (d: {
  title: string;
  content: string;
  annotations: unknown;
  creatorId?: string;
}): DocumentBody => {
  let stored = readStoredAnnotations(d);
  let next = { title: d.title, content: d.content };

  if (stored.status === 'missing' || stored.status === 'invalid') {
    return reconcileStoredDocumentBody({
      previous: null,
      next,
      actorIds: d.creatorId ? [d.creatorId] : []
    });
  }

  return reconcileStoredDocumentBody({
    previous: { ...next, annotations: stored.annotations },
    next,
    actorIds: []
  });
};

export let buildLiveStateFromStoredBody = (d: {
  title: string;
  content: string;
  annotations: unknown;
}) => {
  let { body } = getDocumentBodyMarkdown(d);
  let stored = readStoredAnnotations(d);

  return markdownToYjsUpdate(body, undefined, stored.annotations);
};
