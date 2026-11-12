import { groupBy } from '../lib/util';
import type { Catalog, NameTarget, TokenRates } from '../types';
import type { BuildResult } from './build';

let listLimit = 25;
let unresolvedVendorLimit = 20;

let targetLabel = (target: NameTarget) => {
  if (target.kind === 'model') return target.modelId;
  if (target.kind === 'release') return target.releaseId;
  if (target.kind === 'pointer') return target.pointerId;
  return target.kind;
};

let rates = (value: TokenRates | null) =>
  value ? `${value.input ?? '-'} / ${value.output ?? '-'}` : 'none';

let percent = (part: number, total: number) =>
  total ? `${((part / total) * 100).toFixed(1)}%` : '0%';

let bullets = (items: string[]) => {
  if (!items.length) return ['_none_'];

  let shown = items.slice(0, listLimit).map(item => `- ${item}`);
  if (items.length > listLimit) shown.push(`- … and ${items.length - listLimit} more`);
  return shown;
};

let live = <T extends { status: string }>(items: T[]) =>
  items.filter(item => item.status !== 'retired' && item.status !== 'gone');

let countsTable = (catalog: Catalog) => [
  '| Entity | Live | Total |',
  '| --- | ---: | ---: |',
  ...(
    [
      ['organizations', catalog.organizations],
      ['families', catalog.families],
      ['models', catalog.models],
      ['releases', catalog.releases],
      ['vendors', catalog.vendors],
      ['endpoints', catalog.endpoints],
      ['offerings', catalog.offerings],
      ['names', catalog.names]
    ] as const
  ).map(
    ([label, items]) =>
      `| ${label} | ${live(items as { status: string }[]).length} | ${items.length} |`
  ),
  `| pointers | ${catalog.pointers.length} | ${catalog.pointers.length} |`
];

export let renderReport = (result: BuildResult) => {
  let { catalog, diff, validation } = result;
  let liveOfferings = live(catalog.offerings);
  let resolvedCount = liveOfferings.length - result.resolutionCounts.unresolved;
  let unresolved = liveOfferings.filter(
    offering => offering.resolution.method === 'unresolved'
  );
  let unresolvedByVendor = [...groupBy(unresolved, offering => offering.vendorId)].sort(
    (a, b) => b[1].length - a[1].length
  );

  let lines = [
    '# Model catalog report',
    '',
    `Generated ${catalog.generatedAt} from models.dev \`${result.modelsDevSha}\`.`,
    '',
    '## Sources',
    '',
    '| Source | Status | Error |',
    '| --- | --- | --- |',
    ...catalog.sources.map(
      source => `| ${source.kind} | ${source.status} | ${source.error ?? ''} |`
    ),
    '',
    '## Counts',
    '',
    ...countsTable(catalog),
    '',
    '## Offering resolution',
    '',
    `${resolvedCount} of ${liveOfferings.length} live offerings resolved (${percent(resolvedCount, liveOfferings.length)}).`,
    '',
    '| Method | Offerings |',
    '| --- | ---: |',
    ...Object.entries(result.resolutionCounts).map(
      ([method, count]) => `| ${method} | ${count} |`
    ),
    '',
    '## Vendor listings',
    '',
    '| Source | Matched | Added | Price changes | Delisted |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...result.merges.map(
      merge =>
        `| ${merge.source} | ${merge.matched} | ${merge.added} | ${merge.priceChanges.length} | ${merge.delisted.length} |`
    ),
    '',
    '## Changes since the previous build',
    ''
  ];

  if (!diff.hasPrevious) lines.push('_No previous catalog; this is a first build._', '');
  else
    lines.push(
      '### New models',
      ...bullets(diff.newModels),
      '',
      '### Retired models',
      ...bullets(diff.retiredModels),
      '',
      '### New offerings',
      ...bullets(diff.newOfferings),
      '',
      '### Retired offerings',
      ...bullets(diff.retiredOfferings),
      '',
      '### Newly unresolved offerings',
      ...bullets(diff.newlyUnresolved),
      '',
      '### Price changes (text input / output, USD per 1M tokens)',
      ...bullets(
        diff.priceChanges.map(
          change => `${change.offeringId}: ${rates(change.before)} → ${rates(change.after)}`
        )
      ),
      '',
      '### Retargeted pointers',
      ...bullets(
        diff.retargetedPointers.map(
          change =>
            `${change.pointerId}: ${targetLabel(change.from)} → ${targetLabel(change.to)}`
        )
      ),
      '',
      '### Retargeted names',
      ...bullets(
        diff.retargetedNames.map(
          change => `${change.nameId}: ${targetLabel(change.from)} → ${targetLabel(change.to)}`
        )
      ),
      ''
    );

  let issuesByKind = [...groupBy(result.issues, issue => issue.kind)];

  lines.push(
    `## Open issues (${result.issues.length})`,
    '',
    '| Kind | Issues |',
    '| --- | ---: |',
    ...issuesByKind.map(([kind, items]) => `| ${kind} | ${items.length} |`),
    '',
    '## Unresolved offerings by vendor',
    '',
    '| Vendor | Unresolved | Examples |',
    '| --- | ---: | --- |',
    ...unresolvedByVendor.slice(0, unresolvedVendorLimit).map(
      ([vendorId, items]) =>
        `| ${vendorId} | ${items.length} | ${items
          .slice(0, 4)
          .map(item => `\`${item.vendorModelId}\``)
          .join(', ')} |`
    ),
    '',
    `## Validation errors (${validation.errors.length})`,
    '',
    ...bullets(validation.errors),
    '',
    `## Validation warnings (${validation.warnings.length})`,
    '',
    ...bullets(validation.warnings),
    '',
    `## Source issues (${result.sourceIssues.length})`,
    '',
    ...bullets(result.sourceIssues),
    ''
  );

  return lines.join('\n');
};
