import { clientOf } from './catalog';
import { unknownMemberKey } from './members';
import { countOf } from './money';
import { individualsHiddenError } from './privacy';
import { queryRange, type ResolvedRange } from './range';
import type { Cells } from './spend';
import type {
  AgentTrackingMember,
  AgentTrackingProviderCallFigures,
  AgentTrackingProviderCallItem,
  AgentTrackingRepository,
  ProviderCallGroup
} from './types';

export let providerCallGroups = [
  'repository',
  'member',
  'client'
] as const satisfies readonly ProviderCallGroup[];

export let providerCallsLimit = 10;

let otherKey = '$other';

export let providerCallColumns = {
  repository: 'repo',
  member: 'user',
  client: 'client.family'
} as const satisfies Record<ProviderCallGroup, string>;

export let providerCallsHiddenError = individualsHiddenError({
  message:
    'This organization hides individual data in agent usage, so tool calls are not broken down by repository or client: one can be used by too few people.'
});

export let providerCallsQuery = (d: {
  range: ResolvedRange;
  groupBy: ProviderCallGroup;
  providerId: string | null;
  toolKey: string | null;
}) => {
  let clauses = [
    d.providerId
      ? { field: 'metorial.provider', op: 'eq', value: d.providerId }
      : { field: 'metorial.provider', op: 'notNull' },
    ...(d.toolKey ? [{ field: 'metorial.tool', op: 'eq', value: d.toolKey }] : [])
  ];

  return {
    atq: '0',
    dataset: 'tool_calls',
    range: queryRange(d.range),
    timeZone: d.range.timeZone,
    where: clauses.length > 1 ? { and: clauses } : clauses[0],
    dimensions: [providerCallColumns[d.groupBy]],
    measures: ['tool_calls', 'tool_calls.failed'],
    orderBy: [{ by: 'tool_calls', direction: 'desc' }],
    limit: providerCallsLimit,
    other: true,
    totals: true,
    labels: true
  };
};

export let providerCallFiguresOf = (
  row: Cells | null | undefined
): AgentTrackingProviderCallFigures => ({
  calls: countOf(row?.tool_calls),
  failed: countOf(row?.['tool_calls.failed'])
});

export let providerCallKeysOf = (groupBy: ProviderCallGroup, rows: Cells[]) =>
  rows
    .map(row => row[providerCallColumns[groupBy]])
    .filter((value): value is string => typeof value == 'string' && value != otherKey);

export let providerCallItemsOf = (d: {
  groupBy: ProviderCallGroup;
  rows: Cells[];
  members: Map<string, AgentTrackingMember>;
  repositories: Map<string, AgentTrackingRepository>;
}): AgentTrackingProviderCallItem[] => {
  let none = { member: null, repository: null, client: null };

  return d.rows
    .filter(row => countOf(row.tool_calls) > 0)
    .map(row => {
      let value = row[providerCallColumns[d.groupBy]];
      let figures = providerCallFiguresOf(row);

      if (value === otherKey) return { ...none, kind: 'other', key: 'other', ...figures };
      if (typeof value != 'string') {
        return { ...none, kind: 'unknown', key: unknownMemberKey, ...figures };
      }

      if (d.groupBy == 'client') {
        let client = clientOf({ family: value });

        return {
          ...none,
          kind: 'client',
          key: client.family,
          client: { family: client.family, name: client.name },
          ...figures
        };
      }

      return {
        ...none,
        kind: d.groupBy,
        key: value,
        member: d.groupBy == 'member' ? (d.members.get(value) ?? null) : null,
        repository: d.groupBy == 'repository' ? (d.repositories.get(value) ?? null) : null,
        ...figures
      };
    });
};
