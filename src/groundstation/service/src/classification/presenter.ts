import type { SessionClassification } from '../store/derivedModels';

export let sessionClassificationPresenter = (d: {
  sessionKey: string;
  classification: SessionClassification | undefined;
}) => ({
  object: 'groundstation#session.classification',

  sessionKey: d.sessionKey,
  status: d.classification?.status ?? null,
  runs: d.classification?.runs ?? 0,
  clefCalls: d.classification?.clefCalls ?? 0,

  results: (d.classification?.results ?? []).map(result => ({
    kind: result.kind,
    stage: result.stage,
    candidates: result.candidates.map(candidate => ({
      entityId: candidate.entityId,
      confidence: candidate.confidence
    })),
    accepted: result.accepted
      ? { entityId: result.accepted.entityId, confidence: result.accepted.confidence }
      : null,
    rejectedEntityIds: result.rejectedEntityIds ?? [],
    review: result.review
      ? {
          action: result.review.action,
          entityId: result.review.entityId ?? null,
          at: result.review.at
        }
      : null
  })),

  classifiedAt: d.classification?.at ?? null
});
