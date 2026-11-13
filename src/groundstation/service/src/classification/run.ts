import { QueueRetryError } from '@lowerdeck/queue';
import { reattributeSession } from '../attribution/session';
import { db } from '../db';
import { env } from '../env';
import { getStore, type StoreCollections } from '../store/connection';
import { createContentCipher, type ContentCipher } from '../store/contentCipher';
import type {
  ClassificationCandidate,
  ClassificationResult,
  SessionClassification,
  SessionDocument
} from '../store/derivedModels';
import { loadClassifiableKinds } from './candidates';
import { buildClefRequest, getClefClient, type ClefClient } from './clef';
import { contextHash, loadClassificationFeatures } from './features';
import {
  kindsResolvedElsewhere,
  maxClefCallsPerSession,
  resolveClassificationSettings,
  shouldClassify,
  type ClassificationReason
} from './policy';
import { loadPriorEvidence } from './priors';
import { classificationStatus, clefCandidates, decideResult, isBetterResult } from './results';
import { matchTicketRefs, scorePriors } from './stages';

export type ClassifySessionOutcome = {
  status: SessionClassification['status'] | 'not_due' | 'missing';
  clefCalled: boolean;
};

let defaultCipher = (): ContentCipher | null =>
  env.records.contentSecret ? createContentCipher(env.records.contentSecret) : null;

export let sessionCollections = async () => {
  let store = getStore();
  await store.ready();

  return store.collections();
};

export let writeSessionClassification = async (d: {
  collections: StoreCollections;
  session: SessionDocument;
  classification: SessionClassification;
}) => {
  let previousAt = d.session.classification?.at;

  let result = await d.collections.sessions.updateOne(
    previousAt
      ? { _id: d.session._id, 'classification.at': previousAt }
      : { _id: d.session._id, classification: { $exists: false } },
    { $set: { classification: d.classification } }
  );

  return result.matchedCount > 0;
};

export let classifySession = async (d: {
  sessionKey: string;
  reason: ClassificationReason;
  clef?: ClefClient | null;
  cipher?: ContentCipher | null;
  now?: Date;
}): Promise<ClassifySessionOutcome> => {
  let collections = await sessionCollections();

  let session = await collections.sessions.findOne({ _id: d.sessionKey });
  if (!session) return { status: 'missing', clefCalled: false };
  if (!shouldClassify({ session, reason: d.reason })) {
    return { status: 'not_due', clefCalled: false };
  }

  let [organization, instance] = await Promise.all([
    db.organization.findUnique({ where: { id: session.organizationId } }),
    db.instance.findUnique({ where: { id: session.instanceId } })
  ]);
  if (!organization || organization.archivedAt || !instance || instance.archivedAt) {
    return { status: 'missing', clefCalled: false };
  }

  let settings = resolveClassificationSettings(instance.settings);
  let previous = session.classification;
  let base = {
    runs: (previous?.runs ?? 0) + 1,
    clefCalls: previous?.clefCalls ?? 0,
    contextHash: contextHash(session.context),
    at: d.now ?? new Date()
  };

  let finish = async (classification: SessionClassification, clefCalled: boolean) => {
    let written = await writeSessionClassification({ collections, session, classification });
    if (!written) throw new QueueRetryError();

    await reattributeSession({ sessionKey: session._id });

    return { status: classification.status, clefCalled };
  };

  if (!settings.enabled) {
    return await finish({ ...base, status: 'skipped', results: [] }, false);
  }

  let kept = (previous?.results ?? []).filter(result => result.review?.action == 'accept');
  let rejectedByKind = new Map(
    (previous?.results ?? []).map(result => [result.kind, result.rejectedEntityIds ?? []])
  );

  let excludeKinds = kindsResolvedElsewhere(session);
  for (let result of kept) excludeKinds.add(result.kind);

  let kinds = (await loadClassifiableKinds({ organization, instance, excludeKinds }))
    .map(kind => ({
      ...kind,
      candidates: kind.candidates.filter(
        candidate => !rejectedByKind.get(kind.key)?.includes(candidate.id)
      )
    }))
    .filter(kind => kind.candidates.length);

  if (!kinds.length) {
    let carried = (previous?.results ?? []).filter(result => result.review);
    return await finish(
      { ...base, status: classificationStatus(carried), results: carried },
      false
    );
  }

  let features = await loadClassificationFeatures({
    organization,
    session,
    collections,
    cipher: d.cipher === undefined ? defaultCipher() : d.cipher
  });

  let results = new Map<string, ClassificationResult>();

  let decide = (
    kind: string,
    stage: ClassificationResult['stage'],
    candidates: ClassificationCandidate[]
  ) =>
    decideResult({
      kind,
      stage,
      candidates,
      threshold: settings.threshold,
      rejectedEntityIds: rejectedByKind.get(kind)
    });

  let offer = (result: ClassificationResult) => {
    if (isBetterResult(result, results.get(result.kind))) results.set(result.kind, result);
  };
  let open = () => kinds.filter(kind => !results.get(kind.key)?.accepted);

  for (let kind of kinds) {
    let matches = matchTicketRefs({
      ticketRefs: features.ticketRefs,
      candidates: kind.candidates
    });
    if (matches.length) offer(decide(kind.key, 'ticket', matches));
  }

  let priorKinds = open();
  let evidence = await loadPriorEvidence({
    organization,
    session,
    kinds: priorKinds.map(kind => kind.key),
    collections
  });

  for (let kind of priorKinds) {
    let scored = scorePriors({
      evidence: evidence.get(kind.key) ?? [],
      candidateIds: new Set(kind.candidates.map(candidate => candidate.id))
    });
    if (scored.length) offer(decide(kind.key, 'prior', scored));
  }

  let clefKinds = open();
  let clef = d.clef === undefined ? getClefClient() : d.clef;
  let clefCalled = false;
  let clefFailed = false;

  if (
    clefKinds.length &&
    settings.ai.enabled &&
    clef &&
    base.clefCalls < maxClefCallsPerSession
  ) {
    let built = buildClefRequest({ model: settings.ai.model, features, kinds: clefKinds });
    clefCalled = true;

    try {
      let response = await clef.run(built.request);
      base.clefCalls += 1;

      for (let [questionId, answer] of Object.entries(response.answers)) {
        let kind = built.kindsByQuestionId.get(questionId);
        if (!kind) continue;

        offer(decide(kind, 'clef', clefCandidates(answer, built.candidateIds.get(kind)!)));
      }
    } catch (error) {
      clefFailed = true;
      console.error('Groundstation clef classification failed', error);
    }
  }

  let previousByKind = new Map((previous?.results ?? []).map(result => [result.kind, result]));

  for (let kind of kinds) {
    if (results.has(kind.key)) continue;

    let earlier = previousByKind.get(kind.key);
    results.set(
      kind.key,
      earlier && !earlier.accepted && !earlier.review
        ? earlier
        : decide(kind.key, clefCalled ? 'clef' : 'prior', [])
    );
  }

  let rejected = (previous?.results ?? []).filter(
    result => result.review?.action == 'reject' && !results.has(result.kind)
  );

  let all = [...kept, ...rejected, ...results.values()];
  let status =
    clefFailed && all.some(result => !result.accepted) ? 'pending' : classificationStatus(all);

  return await finish({ ...base, status, results: all }, clefCalled);
};
