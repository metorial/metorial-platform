import { useEffect, useSyncExternalStore } from 'react';

let OPTIMISTIC_REVISION_ID = 'optimistic';
let OPTIMISTIC_TIMEOUT_MS = 45_000;

type Request = { baselineRevisionId: string | null; at: number };

let requests = new Map<string, Request>();
let listeners = new Set<() => void>();
let version = 0;

let notify = () => {
  version++;
  listeners.forEach(listener => listener());
};

export let requestReassess = (key: string, baselineRevisionId: string | null) => {
  requests.set(key, { baselineRevisionId, at: Date.now() });
  notify();
};

export let clearReassess = (key: string) => {
  if (requests.delete(key)) notify();
};

export let useIsReassessRequested = (key: string | null) =>
  useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (key ? requests.has(key) : false)
  );

type RevisionLike = {
  id: string;
  status: string;
  stage: string | null;
};

let resettable = ['activity', 'startedAt', 'completedAt'];

type ReviewLike<R extends RevisionLike> = {
  currentRevision: R | null;
  inProgressRevision: R | null;
};

let isRunning = (revision: RevisionLike | null) =>
  revision?.status == 'queued' || revision?.status == 'running';

// The server creates the revision asynchronously, so a reassessment is invisible for a moment
// after the request returns. Until the real revision shows up, the review is shown as queued.
export let useOptimisticReassess = <R extends RevisionLike, T extends ReviewLike<R>>(
  key: string | null,
  review: T | null | undefined
): T | null | undefined => {
  useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version
  );

  let request = key ? requests.get(key) : undefined;
  let hasRequest = !!request;

  let isObserved =
    !!request &&
    !!review &&
    (isRunning(review.inProgressRevision) ||
      (review.currentRevision?.id ?? null) != request.baselineRevisionId);
  let isExpired = !!request && Date.now() - request.at > OPTIMISTIC_TIMEOUT_MS;

  useEffect(() => {
    if (!key || !hasRequest) return;
    if (isObserved || isExpired) return clearReassess(key);

    let timer = setTimeout(() => clearReassess(key), OPTIMISTIC_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [key, hasRequest, isObserved, isExpired]);

  if (!request || !review || isObserved || isExpired || !review.currentRevision) return review;

  let current = review.currentRevision;

  return {
    ...review,
    inProgressRevision: {
      ...current,
      ...Object.fromEntries(resettable.filter(field => field in current).map(f => [f, null])),
      id: OPTIMISTIC_REVISION_ID,
      status: 'queued',
      stage: null
    }
  };
};
