import type { Context } from '@metorial/context';

export type DocumentDraftActor = {
  id: string;
  context?: Context;
};

type DraftActors = {
  actors?: DocumentDraftActor[];
  actorIds?: string[];
};

export let getDocumentDraftActors = (draft: DraftActors): DocumentDraftActor[] => {
  let actors = new Map<string, DocumentDraftActor>();

  for (let id of draft.actorIds ?? []) actors.set(id, { id });
  for (let actor of draft.actors ?? []) actors.set(actor.id, { ...actor });

  return [...actors.values()];
};

export let withDocumentDraftActor = (
  draft: DraftActors,
  actor: DocumentDraftActor
): DocumentDraftActor[] => {
  let actors = getDocumentDraftActors(draft);
  let existing = actors.find(current => current.id == actor.id);
  if (!existing) return [...actors, actor];

  return actors.map(current =>
    current.id == actor.id
      ? { ...current, context: current.context ?? actor.context }
      : current
  );
};
