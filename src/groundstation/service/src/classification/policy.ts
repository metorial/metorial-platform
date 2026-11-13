import type { SessionDocument } from '../store/derivedModels';
import type { InstanceSettings } from '../types';
import type { ClefModel } from './clef';
import { contextHash } from './features';
import { latestManualAssignments } from './priors';

export let defaultThreshold = 0.8;
export let maxClefCallsPerSession = 2;
export let maxAutomaticRuns = 2;

export type ClassificationReason = 'turn_completed' | 'idle' | 'manual';

export type ResolvedClassificationSettings = {
  enabled: boolean;
  threshold: number;
  ai: { enabled: boolean; model: ClefModel };
};

export let resolveClassificationSettings = (
  settings: InstanceSettings | null | undefined
): ResolvedClassificationSettings => ({
  enabled: settings?.classification?.enabled ?? true,
  threshold: settings?.classification?.threshold ?? defaultThreshold,
  ai: {
    enabled: settings?.classification?.ai?.enabled ?? false,
    model: settings?.classification?.ai?.model ?? 'clef'
  }
});

// 07 §7.3: a first run after the first completed turn (or when the session goes idle without
// one), one re-run on idle only when the first run stayed below the threshold or the context
// changed, and nothing automatic after a result was accepted or reviewed. `manual`
// (session.reclassify) skips these conditions; the clef call cap still applies in the run.
export let shouldClassify = (d: {
  session: Pick<SessionDocument, 'classification' | 'context'>;
  reason: ClassificationReason;
}) => {
  if (d.reason == 'manual') return true;

  let classification = d.session.classification;
  if (!classification || classification.runs == 0) return true;

  if (classification.status == 'accepted' || classification.status == 'rejected') return false;
  if (d.reason != 'idle' || classification.runs >= maxAutomaticRuns) return false;

  return (
    classification.status == 'needs_review' ||
    classification.status == 'pending' ||
    classification.contextHash != contextHash(d.session.context)
  );
};

export let kindsResolvedElsewhere = (
  session: Pick<SessionDocument, 'attribution' | 'manual'>
) => {
  let kinds = new Set<string>();

  for (let entry of session.attribution?.entries ?? []) {
    if (entry.source != 'classifier') kinds.add(entry.kind);
  }
  for (let kind of latestManualAssignments(session.manual ?? []).keys()) kinds.add(kind);

  return kinds;
};
