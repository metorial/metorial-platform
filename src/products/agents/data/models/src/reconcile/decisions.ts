import type { OfferingDecision, OverrideFiles } from '../overrides';
import type { CatalogIssue } from '../pipeline/issues';

export let maxDeferDays = 30;

export interface AcceptedDecision {
  key: string;
  vendorId: string;
  vendorModelId: string;
  decision: OfferingDecision;
}

export interface DecisionReview {
  files: OverrideFiles;
  accepted: AcceptedDecision[];
  rejected: { key: string; reason: string }[];
  reverted: string[];
}

let addDays = (day: string, days: number) => {
  let date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

let sameDecision = (a: OfferingDecision | undefined, b: OfferingDecision | undefined) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

let rejectionFor = (
  decision: OfferingDecision,
  opts: { modelIds: Set<string>; today: string; secrets: string[] }
) => {
  if (opts.secrets.some(secret => secret && JSON.stringify(decision).includes(secret)))
    return 'contains a credential';
  if (decision.decision === 'link' && !opts.modelIds.has(decision.model))
    return `model ${decision.model} does not exist; pick an id from models.tsv`;
  if (
    decision.decision === 'defer' &&
    (decision.until <= opts.today || decision.until > addDays(opts.today, maxDeferDays))
  )
    return `until must be after ${opts.today} and no later than ${addDays(opts.today, maxDeferDays)}`;
  return null;
};

// The agent may only add or change offering decisions for issues in its batch. Everything else
// it touched is put back, and every decision it keeps is stamped as an agent decision.
export let reviewDecisions = (opts: {
  before: OverrideFiles;
  after: OverrideFiles;
  batch: CatalogIssue[];
  modelIds: Set<string>;
  today: string;
  secrets: string[];
}): DecisionReview => {
  let batchKeys = new Map(opts.batch.map(issue => [issue.key, issue]));
  let files: OverrideFiles = structuredClone(opts.before);
  let accepted: AcceptedDecision[] = [];
  let rejected: DecisionReview['rejected'] = [];
  let reverted: string[] = [];

  for (let section of ['merges', 'models', 'families'] as const)
    if (JSON.stringify(opts.before[section]) !== JSON.stringify(opts.after[section]))
      reverted.push(`${section}.json`);

  let vendorIds = new Set([
    ...Object.keys(opts.before.offerings),
    ...Object.keys(opts.after.offerings)
  ]);

  for (let vendorId of vendorIds) {
    let before = opts.before.offerings[vendorId] ?? {};
    let after = opts.after.offerings[vendorId] ?? {};

    for (let vendorModelId of new Set([...Object.keys(before), ...Object.keys(after)])) {
      let key = `${vendorId}/${vendorModelId}`;
      let decision = after[vendorModelId];
      if (sameDecision(before[vendorModelId], decision)) continue;

      if (!decision || !batchKeys.has(key)) {
        reverted.push(key);
        continue;
      }

      let rejection = rejectionFor(decision, opts);
      if (rejection) {
        rejected.push({ key, reason: rejection });
        continue;
      }

      let stamped: OfferingDecision = { ...decision, by: 'agent', at: opts.today };
      files.offerings[vendorId] = {
        ...(files.offerings[vendorId] ?? {}),
        [vendorModelId]: stamped
      };
      accepted.push({ key, vendorId, vendorModelId, decision: stamped });
    }
  }

  return { files, accepted, rejected, reverted };
};
