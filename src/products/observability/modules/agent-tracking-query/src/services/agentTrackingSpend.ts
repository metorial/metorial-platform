import { isServiceError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { lookupMembers, unknownMemberKey } from '../lib/members';
import { countOf } from '../lib/money';
import { individualsHiddenError, loadPrivacy } from '../lib/privacy';
import {
  assertPrivateRead,
  breakdownHiddenError,
  emptyPrivateRange,
  privateDays,
  privateRange,
  privateTimeZone
} from '../lib/privateSpend';
import {
  breakdownGroups,
  breakdownQuery,
  distinctCappedWarning,
  normalizeSpendFilters,
  periodTotalQuery,
  retentionClippedWarning,
  timelineQuery,
  unknownModelsQuery
} from '../lib/queries';
import {
  calendarDateIn,
  calendarDateKey,
  defaultRangePreset,
  normalizeRange,
  previousRange,
  rangeCacheKey,
  resolveRange,
  type RangeInput,
  type ResolvedRange
} from '../lib/range';
import {
  cachedRead,
  resolveServiceInstanceId,
  runUsageQuery,
  type ReadScope
} from '../lib/scope';
import {
  dayCountsOf,
  dayItem,
  hasUsage,
  modelUsageItem,
  spendFiguresOf,
  usageItem,
  type Cells
} from '../lib/spend';
import type {
  AgentTrackingMember,
  AgentTrackingSpendBreakdown,
  AgentTrackingSpendBreakdownItem,
  AgentTrackingSpendFilters,
  AgentTrackingSpendTimeline,
  BreakdownGroup
} from '../lib/types';

let otherKey = '$other';

type UsageResult = {
  rows: Cells[];
  totals?: Cells | null;
  labels?: Record<string, unknown>;
  meta?: { warnings?: { code?: string }[] };
};

let noRows: UsageResult = { rows: [], totals: null };

let warned = (result: UsageResult, code: string) =>
  (result.meta?.warnings ?? []).some(warning => warning.code == code);

class AgentTrackingSpendServiceImpl {
  async getTimeline(
    d: ReadScope & { range: RangeInput; filters?: AgentTrackingSpendFilters }
  ): Promise<AgentTrackingSpendTimeline> {
    let filters = normalizeSpendFilters(d.filters);
    let privacy = await loadPrivacy(d);
    let hidden = privacy.hideIndividuals;
    if (hidden) assertPrivateRead({ range: d.range, filters });

    let now = new Date();
    let preset = d.range.preset ?? defaultRangePreset;
    let range = hidden ? null : normalizeRange(d.range);

    return await cachedRead({
      scope: d,
      read: hidden ? 'spend.timeline.private' : 'spend.timeline',
      input: range
        ? { range: rangeCacheKey(range, now), filters }
        : {
            preset,
            today: calendarDateKey(calendarDateIn(now, privateTimeZone)),
            minGroupUsers: privacy.minGroupUsers
          },
      load: async () => {
        let resolved = range ? resolveRange(range, now) : privateRange(preset, now);
        let current = resolved ?? emptyPrivateRange(preset, now);
        let previous: ResolvedRange = {
          ...(resolved ? previousRange(resolved) : current),
          preset: null,
          timeZone: current.timeZone
        };

        let [result, before]: [UsageResult, UsageResult] = [noRows, noRows];
        if (resolved) {
          let instanceId = await resolveServiceInstanceId(d);
          [result, before] = await Promise.all([
            runUsageQuery(d, instanceId, timelineQuery(resolved, filters)),
            runUsageQuery(
              d,
              instanceId,
              hidden ? timelineQuery(previous) : periodTotalQuery(previous, filters)
            )
          ]);
        }

        let days = hidden ? privateDays({ range: current, rows: result.rows, privacy }) : null;
        let earlier = hidden
          ? privateDays({ range: previous, rows: before.rows, privacy })
          : null;

        return {
          range: current,
          interval: 'day' as const,
          total: spendFiguresOf(days ? days.total : result.totals),
          counts: days?.anyHidden
            ? null
            : {
                ...dayCountsOf(result.totals),
                capped: warned(result, distinctCappedWarning)
              },
          previous: {
            range: previous,
            total: spendFiguresOf(earlier ? earlier.total : before.totals),
            startsBeforeRetention: warned(before, retentionClippedWarning),
            hiddenGroups: earlier?.anyHidden ?? false
          },
          privacy: {
            hideIndividuals: hidden,
            minGroupUsers: privacy.minGroupUsers,
            hiddenGroups: days?.anyHidden ?? false
          },
          items: days ? days.items : result.rows.flatMap(row => dayItem(row) ?? [])
        };
      }
    });
  }

  async getBreakdown(
    d: ReadScope & {
      range: RangeInput;
      groupBy: BreakdownGroup;
      filters?: AgentTrackingSpendFilters;
    }
  ): Promise<AgentTrackingSpendBreakdown> {
    let filters = normalizeSpendFilters(d.filters);
    let privacy = await loadPrivacy(d);
    if (privacy.hideIndividuals) {
      throw new ServiceError(
        d.groupBy == 'member' ? individualsHiddenError : breakdownHiddenError
      );
    }

    let range = normalizeRange(d.range);
    let now = new Date();

    return await cachedRead({
      scope: d,
      read: 'spend.breakdown',
      input: { range: rangeCacheKey(range, now), groupBy: d.groupBy, filters },
      load: async () => {
        let resolved = resolveRange(range, now);
        let instanceId = await resolveServiceInstanceId(d);

        let column = breakdownGroups[d.groupBy];
        let result = await runUsageQuery(
          d,
          instanceId,
          breakdownQuery({ range: resolved, groupBy: d.groupBy, filters })
        );

        let labels = (result.labels[column] ?? {}) as Record<string, { name?: string | null }>;
        let rows = result.rows.filter(hasUsage);
        let hasUnknown = rows.some(row => typeof row[column] != 'string');
        let keys = rows
          .map(row => row[column])
          .filter((value): value is string => typeof value == 'string' && value != otherKey);

        let [members, unknownModelNames] = await Promise.all([
          d.groupBy == 'member'
            ? lookupMembers({
                scope: d,
                ids: keys,
                names: new Map(keys.map(key => [key, labels[key]?.name ?? null]))
              })
            : new Map<string, AgentTrackingMember>(),
          d.groupBy == 'model' && hasUnknown
            ? this.unknownModelNames({ scope: d, instanceId, range: resolved, filters })
            : []
        ]);

        return {
          range: resolved,
          groupBy: d.groupBy,
          total: spendFiguresOf(result.totals),
          items: rows.map((row): AgentTrackingSpendBreakdownItem => {
            let value = row[column];

            if (value === otherKey) {
              return { member: null, ...usageItem(row, { kind: 'other', key: 'other' }) };
            }
            if (d.groupBy == 'model') {
              return { member: null, ...modelUsageItem(row, labels, unknownModelNames) };
            }
            if (typeof value != 'string') {
              return {
                member: null,
                ...usageItem(row, { kind: 'unknown', key: unknownMemberKey })
              };
            }

            return {
              member: members.get(value) ?? null,
              ...usageItem(row, { kind: 'member', key: value })
            };
          })
        };
      }
    });
  }

  // The names explain the unknown item; when they cannot be read, the item is still shown.
  private async unknownModelNames(d: {
    scope: ReadScope;
    instanceId: string;
    range: ResolvedRange;
    filters: AgentTrackingSpendFilters;
  }): Promise<string[]> {
    let result;
    try {
      result = await runUsageQuery(
        d.scope,
        d.instanceId,
        unknownModelsQuery(d.range, d.filters)
      );
    } catch (error) {
      if (isServiceError(error)) return [];
      throw error;
    }

    return result.rows
      .filter(row => typeof row['model.raw'] == 'string' && countOf(row.requests) > 0)
      .map(row => row['model.raw'] as string);
  }
}

export let agentTrackingSpendService = Service.create(
  'agentTrackingSpendService',
  () => new AgentTrackingSpendServiceImpl()
).build();
