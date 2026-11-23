import { isServiceError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AgentTrackingPrivacy } from '@metorial/module-agent-tracking-sync';
import { clientOf } from '../lib/catalog';
import { invalidInputError } from '../lib/errors';
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
import { baselineMaxDays, notApplicableProjection, projectSpend } from '../lib/projection';
import {
  breakdownQuery,
  distinctCappedWarning,
  normalizeSpendFilters,
  periodTotalQuery,
  reportBreakdownGroups,
  reportBreakdownLimits,
  retentionClippedWarning,
  timelineQuery,
  unknownModelsQuery
} from '../lib/queries';
import {
  canonicalTimeZone,
  calendarDateIn,
  calendarDateKey,
  daysInMonth,
  defaultRangePreset,
  monthKeyOf,
  normalizeRange,
  previousRange,
  rangeCacheKey,
  resolveRange,
  shiftDays,
  startOfDayIn,
  type CalendarDate,
  type RangeInput,
  type ResolvedRange
} from '../lib/range';
import {
  cachedRead,
  runUsageQueries,
  runUsageQuery,
  warned,
  type ReadScope,
  type UsageResult
} from '../lib/scope';
import {
  dayCountsOf,
  dayItem,
  hasUsage,
  modelUsageItem,
  spendFiguresOf,
  usageItem
} from '../lib/spend';
import type {
  AgentTrackingMember,
  AgentTrackingSpendBreakdown,
  AgentTrackingSpendBreakdownItem,
  AgentTrackingSpendDay,
  AgentTrackingSpendFilters,
  AgentTrackingSpendReport,
  AgentTrackingSpendReportMonth,
  AgentTrackingSpendTimeline,
  BreakdownGroup,
  SpendReportGroup
} from '../lib/types';

let otherKey = '$other';

let noRows: UsageResult = { rows: [], totals: null };

let dayHasData = (day: AgentTrackingSpendDay) =>
  day.hidden ||
  (day.requests ?? 0) > 0 ||
  (day.tokens?.total ?? 0) > 0 ||
  (day.cost?.totalMicros ?? 0) != 0;

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
          [result, before] = await Promise.all([
            runUsageQuery(d, timelineQuery(resolved, filters)),
            runUsageQuery(
              d,
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
        d.groupBy == 'member' || filters.memberIds
          ? individualsHiddenError
          : breakdownHiddenError
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
        let result = await runUsageQuery(
          d,
          breakdownQuery({ range: resolved, groupBy: d.groupBy, filters })
        );

        return {
          range: resolved,
          groupBy: d.groupBy,
          total: spendFiguresOf(result.totals),
          items: await this.breakdownItems({
            scope: d,
            range: resolved,
            groupBy: d.groupBy,
            filters,
            result
          })
        };
      }
    });
  }

  async getReport(
    d: ReadScope & { year?: number; timeZone?: string; growthRate?: number }
  ): Promise<AgentTrackingSpendReport> {
    let requestedTimeZone = canonicalTimeZone(d.timeZone ?? 'UTC');

    let privacy = await loadPrivacy(d);
    let hidden = privacy.hideIndividuals;
    let timeZone = hidden ? privateTimeZone : requestedTimeZone;

    let now = new Date();
    let today = calendarDateIn(now, timeZone);
    let year = d.year ?? today.year;
    if (year > today.year) {
      throw invalidInputError(
        `There is no report for ${year} yet: it is ${today.year} in ${timeZone}.`
      );
    }
    if (year < today.year - 1) {
      throw invalidInputError(`Reports cover ${today.year} and ${today.year - 1} only.`);
    }

    let { projectionInput, ...report } = await cachedRead({
      scope: d,
      read: hidden ? 'spend.report.private' : 'spend.report',
      input: {
        year,
        timeZone,
        today: calendarDateKey(today),
        ...(hidden ? { minGroupUsers: privacy.minGroupUsers } : {})
      },
      load: () => this.loadReport({ scope: d, year, timeZone, now, privacy })
    });

    return {
      ...report,
      projection: projectionInput
        ? projectSpend({ ...projectionInput, growthRate: d.growthRate })
        : notApplicableProjection
    };
  }

  private async loadReport(d: {
    scope: ReadScope;
    year: number;
    timeZone: string;
    now: Date;
    privacy: AgentTrackingPrivacy;
  }) {
    let hidden = d.privacy.hideIndividuals;
    let today = calendarDateIn(d.now, d.timeZone);
    let current = d.year == today.year;
    let start = (date: CalendarDate) => startOfDayIn(date, d.timeZone);

    let yearStart = { year: d.year, month: 1, day: 1 };
    let from = start(yearStart);
    let yearEnd = start({ ...yearStart, year: d.year + 1 });
    let to = !current ? yearEnd : hidden ? start(today) : d.now;
    let range: ResolvedRange = { preset: null, from, to, timeZone: d.timeZone };
    let series: ResolvedRange = {
      ...range,
      from: start({ year: d.year - 1, month: 12, day: 1 })
    };

    let started = to > from;
    let groups: SpendReportGroup[] = started && !hidden ? ['model', 'client', 'member'] : [];
    let [daily = noRows, monthly = noRows, ...grouped] = (
      await runUsageQueries(d.scope, [
        timelineQuery(series),
        started ? timelineQuery(range, {}, 'month') : null,
        ...groups.map(groupBy =>
          breakdownQuery({ range, groupBy, limit: reportBreakdownLimits[groupBy] })
        )
      ])
    ).map(result => result ?? noRows);

    let days = hidden
      ? privateDays({ range: series, rows: daily.rows, privacy: d.privacy }).items
      : daily.rows.flatMap(row => dayItem(row) ?? []);
    let shownYear = hidden
      ? privateDays({ range, rows: daily.rows, privacy: d.privacy })
      : null;

    let monthRows = new Map(
      monthly.rows.flatMap(row => {
        let key = row['time.month'];
        return typeof key == 'string' ? [[key.slice(0, 7), row] as const] : [];
      })
    );
    let months = Array.from({ length: current ? today.month : 12 }, (_, index) => {
      let month = { year: d.year, month: index + 1, day: 1 };
      let key = monthKeyOf(month);
      let startsAt = start(month);
      let row = monthRows.get(key) ?? null;
      if (!hidden) {
        return {
          month: key,
          startsAt,
          hiddenDays: 0,
          ...spendFiguresOf(row),
          counts: dayCountsOf(row)
        };
      }

      let next = start(shiftDays({ ...month, day: daysInMonth(month) }, 1));
      let shown = privateDays({
        range: { ...range, from: startsAt, to: next < to ? next : to },
        rows: daily.rows,
        privacy: d.privacy
      });

      return {
        month: key,
        startsAt,
        hiddenDays: shown.items.filter(item => item.hidden).length,
        ...spendFiguresOf(shown.total),
        counts: shown.anyHidden || !row ? null : dayCountsOf(row)
      };
    });

    let yearStartKey = calendarDateKey(yearStart);
    let yearDays = days.filter(day => day.date >= yearStartKey);
    let daysBefore = days.filter(day => day.date < yearStartKey);
    let withData = yearDays.filter(dayHasData);
    let total = spendFiguresOf(shownYear ? shownYear.total : monthly.totals);

    let breakdowns: AgentTrackingSpendReport['breakdowns'] = {
      model: null,
      client: null,
      member: null
    };
    await Promise.all(
      groups.map(async (groupBy, index) => {
        breakdowns[groupBy] = await this.breakdownItems({
          scope: d.scope,
          range,
          groupBy,
          filters: {},
          result: grouped[index]!
        });
      })
    );

    return {
      year: d.year,
      range,
      total,
      counts: shownYear?.anyHidden
        ? null
        : {
            ...dayCountsOf(monthly.totals),
            capped: warned(monthly, distinctCappedWarning)
          },
      startsBeforeRetention: warned(monthly, retentionClippedWarning),
      privacy: {
        hideIndividuals: hidden,
        minGroupUsers: d.privacy.minGroupUsers,
        hiddenGroups: shownYear?.anyHidden ?? false
      },
      months,
      coverage: {
        firstDay: withData[0]?.date ?? null,
        daysWithData: withData.length,
        hiddenDays: yearDays.filter(day => day.hidden).length,
        startsBeforeYear: daysBefore.some(dayHasData),
        lastFullDay: !current
          ? calendarDateKey({ year: d.year, month: 12, day: 31 })
          : today.month == 1 && today.day == 1
            ? null
            : calendarDateKey(shiftDays(today, -1))
      },
      breakdowns,
      projectionInput: current
        ? this.projectionInput({
            today,
            to,
            timeZone: d.timeZone,
            days,
            months,
            usageStart: days.find(dayHasData)?.date ?? null,
            yearToDateMicros: total.cost.totalMicros ?? 0
          })
        : null
    };
  }

  private projectionInput(d: {
    today: CalendarDate;
    to: Date;
    timeZone: string;
    days: AgentTrackingSpendDay[];
    months: AgentTrackingSpendReportMonth[];
    usageStart: string | null;
    yearToDateMicros: number;
  }) {
    let start = (date: CalendarDate) => startOfDayIn(date, d.timeZone);
    let tomorrow = start(shiftDays(d.today, 1));
    let todayKey = calendarDateKey(d.today);
    let windowStart = calendarDateKey(shiftDays(d.today, -baselineMaxDays));

    let costOf = (day: AgentTrackingSpendDay) =>
      day.hidden ? null : (day.cost?.totalMicros ?? 0);

    return {
      today: d.today,
      todayRemaining:
        (tomorrow.getTime() - d.to.getTime()) /
        (tomorrow.getTime() - start(d.today).getTime()),
      usageStart: d.usageStart,
      days: d.days
        .filter(day => day.date >= windowStart && day.date < todayKey)
        .map(day => ({ date: day.date, costMicros: costOf(day) })),
      months: d.months.map(month => ({
        month: month.month,
        costMicros: month.cost.totalMicros ?? 0,
        hasHiddenDays: month.hiddenDays > 0
      })),
      yearToDateMicros: d.yearToDateMicros
    };
  }

  private async breakdownItems(d: {
    scope: ReadScope;
    range: ResolvedRange;
    groupBy: SpendReportGroup;
    filters: AgentTrackingSpendFilters;
    result: UsageResult;
  }): Promise<AgentTrackingSpendBreakdownItem[]> {
    let column = reportBreakdownGroups[d.groupBy];
    let labels = (d.result.labels?.[column] ?? {}) as Record<string, { name?: string | null }>;
    let rows = d.result.rows.filter(hasUsage);
    let hasUnknown = rows.some(row => typeof row[column] != 'string');
    let keys = rows
      .map(row => row[column])
      .filter((value): value is string => typeof value == 'string' && value != otherKey);

    let [members, unknownModelNames] = await Promise.all([
      d.groupBy == 'member'
        ? lookupMembers({
            scope: d.scope,
            ids: keys,
            names: new Map(keys.map(key => [key, labels[key]?.name ?? null]))
          })
        : new Map<string, AgentTrackingMember>(),
      d.groupBy == 'model' && hasUnknown
        ? this.unknownModelNames({ scope: d.scope, range: d.range, filters: d.filters })
        : []
    ]);

    return rows.map((row): AgentTrackingSpendBreakdownItem => {
      let value = row[column];

      if (value === otherKey) {
        return {
          member: null,
          client: null,
          ...usageItem(row, { kind: 'other', key: 'other' })
        };
      }
      if (d.groupBy == 'model') {
        return {
          member: null,
          client: null,
          ...modelUsageItem(row, labels, unknownModelNames)
        };
      }
      if (typeof value != 'string') {
        return {
          member: null,
          client: null,
          ...usageItem(row, { kind: 'unknown', key: unknownMemberKey })
        };
      }
      if (d.groupBy == 'client') {
        let client = clientOf({ family: value });

        return {
          member: null,
          client: { family: client.family, name: client.name },
          ...usageItem(row, { kind: 'client', key: client.family })
        };
      }

      return {
        member: members.get(value) ?? null,
        client: null,
        ...usageItem(row, { kind: 'member', key: value })
      };
    });
  }

  private async unknownModelNames(d: {
    scope: ReadScope;
    range: ResolvedRange;
    filters: AgentTrackingSpendFilters;
  }): Promise<string[]> {
    let result;
    try {
      result = await runUsageQuery(d.scope, unknownModelsQuery(d.range, d.filters));
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
