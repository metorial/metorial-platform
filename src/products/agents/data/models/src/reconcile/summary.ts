import type { DecisionReview } from './decisions';

let listLimit = 200;

export interface IterationLog {
  iteration: number;
  batch: number;
  exitCode: number;
  outcome: string;
  solved?: number;
  review?: DecisionReview;
  restored?: string[];
}

let cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');

let decisionLabel = (decision: DecisionReview['accepted'][number]['decision']) => {
  if (decision.decision === 'link') return `link → \`${decision.model}\``;
  if (decision.decision === 'exclude') return `exclude (${decision.category})`;
  if (decision.decision === 'defer') return `defer until ${decision.until}`;
  return decision.decision;
};

let capped = (lines: string[]) =>
  lines.length > listLimit
    ? [...lines.slice(0, listLimit), `- … and ${lines.length - listLimit} more`]
    : lines;

export let renderSummary = (input: {
  model: string;
  iterations: IterationLog[];
  initialIssues: number;
  remainingIssues: number;
  stopReason: string;
  changed: boolean;
}) => {
  let accepted = input.iterations.flatMap(entry => entry.review?.accepted ?? []);
  let rejected = input.iterations.flatMap(entry => entry.review?.rejected ?? []);
  let reverted = input.iterations.flatMap(entry => [
    ...(entry.review?.reverted ?? []),
    ...(entry.restored ?? [])
  ]);

  let lines = [
    '# Model catalog reconciliation',
    '',
    `${accepted.length} decisions by \`${input.model}\` over ${input.iterations.length} batches. Open issues: ${input.initialIssues} → ${input.remainingIssues}. Stopped: ${input.stopReason}.`,
    '',
    input.changed
      ? 'Every decision passed review and a rebuild with no validation errors.'
      : '_No override changes._',
    '',
    '| Batch | Issues | pi exit | Outcome | Solved |',
    '| ---: | ---: | ---: | --- | ---: |',
    ...input.iterations.map(
      entry =>
        `| ${entry.iteration} | ${entry.batch} | ${entry.exitCode} | ${cell(entry.outcome)} | ${entry.solved ?? 0} |`
    ),
    ''
  ];

  if (accepted.length)
    lines.push(
      '## Decisions',
      '',
      '| Offering | Decision | Reason |',
      '| --- | --- | --- |',
      ...capped(
        accepted.map(
          entry =>
            `| \`${cell(entry.key)}\` | ${decisionLabel(entry.decision)} | ${cell(entry.decision.reason)} |`
        )
      ),
      ''
    );

  if (rejected.length)
    lines.push(
      `## Rejected (${rejected.length})`,
      '',
      ...capped(rejected.map(entry => `- \`${entry.key}\`: ${entry.reason}`)),
      ''
    );

  if (reverted.length)
    lines.push(
      `## Edits outside the batch, reverted (${reverted.length})`,
      '',
      ...capped(reverted.map(entry => `- \`${entry}\``)),
      ''
    );

  return lines.join('\n');
};
