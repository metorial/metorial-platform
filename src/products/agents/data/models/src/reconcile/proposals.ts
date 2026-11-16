import { v } from '@lowerdeck/validation';
import { parseWith } from '../lib/validate';
import { parseDecision, type OverrideFiles } from '../overrides';
import type { CatalogIssue } from '../pipeline/issues';

let schema = v.object({
  decisions: v.array(v.object({ key: v.string(), decision: v.any() }))
});

export let proposedDecisions = (d: {
  answer: string;
  before: OverrideFiles;
  batch: CatalogIssue[];
}) => {
  let parsed = parseWith(
    schema,
    JSON.parse(d.answer.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1')),
    'decision proposal'
  );
  let files = structuredClone(d.before);
  let issues = new Map(d.batch.map(issue => [issue.key, issue]));
  let seen = new Set<string>();

  for (let entry of parsed.decisions) {
    let issue = issues.get(entry.key);
    if (!issue || seen.has(entry.key))
      throw new Error(`Decision is outside the batch or duplicated: ${entry.key}`);
    seen.add(entry.key);
    let decision = parseDecision(entry.decision, entry.key);

    files.offerings = {
      ...files.offerings,
      [issue.vendorId]: { ...files.offerings[issue.vendorId], [issue.vendorModelId]: decision }
    };
  }

  return files;
};
