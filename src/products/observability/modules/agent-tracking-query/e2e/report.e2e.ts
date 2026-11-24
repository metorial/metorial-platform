import {
  expectServiceError,
  uniqueEmail,
  uniqueId,
  useOrganization,
  type BootstrappedOrganization
} from '@metorial/e2e';
import { claudeRequest, ingestFirstUsage } from '@metorial/agent-tracking-e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { agentTrackingSettingsService } from '@metorial/module-agent-tracking-sync';
import { beforeAll, describe, expect, it } from 'vitest';
import { agentTrackingSpendService, type AgentTrackingSpendReport } from '../src';
import { dayMs, isoDate, madeUpModel, minuteMs, readScope } from './_fixtures';

type Scope = Awaited<ReturnType<typeof readScope>>;

let hourMs = 60 * minuteMs;

let startOfTodayUtc = () => Math.floor(Date.now() / dayMs) * dayMs;

let currentYear = () => new Date().getUTCFullYear();

let sumOf = <T>(items: T[], pick: (item: T) => number) =>
  items.reduce((total, item) => total + pick(item), 0);

let monthsUntil = (at: Date) =>
  Array.from(
    { length: at.getUTCMonth() + 1 },
    (_, index) => `${at.getUTCFullYear()}-${String(index + 1).padStart(2, '0')}`
  );

let daysFrom = (from: number) => Math.round((startOfTodayUtc() - from) / dayMs);

let inYearOf = (report: AgentTrackingSpendReport, at: number | Date) =>
  isoDate(at).startsWith(`${report.year}-`);

let setPrivacy = async (
  org: BootstrappedOrganization,
  privacy: { hideIndividuals?: boolean; minGroupUsers?: number }
) => {
  let fixture = await loadOrganizationFixture(org.ids);
  await agentTrackingSettingsService.updateOrganizationSettings({
    organization: fixture.organization,
    auditScope: fixture.auditScope,
    input: { privacy }
  });
};

describe('module-agent-tracking-query spend report of an instance without usage', () => {
  let org = useOrganization();

  it('returns a zero month from January to now, no coverage, empty lists and no projection', async () => {
    let report = await agentTrackingSpendService.getReport(await readScope(org));

    expect(report.year).toBe(report.range.to.getUTCFullYear());
    expect(report.range).toMatchObject({
      preset: null,
      from: new Date(Date.UTC(report.year, 0, 1)),
      timeZone: 'UTC'
    });
    expect(report.months.map(month => month.month)).toEqual(monthsUntil(report.range.to));
    for (let month of report.months) {
      expect(month).toMatchObject({
        hiddenDays: 0,
        requests: 0,
        cost: { totalMicros: 0, billedMicros: null },
        counts: { sessions: 0, members: 0 }
      });
    }
    expect(report.total).toMatchObject({ requests: 0, cost: { totalMicros: 0 } });
    expect(report.counts).toEqual({ sessions: 0, members: 0, capped: false });
    expect(report.coverage).toMatchObject({
      firstDay: null,
      daysWithData: 0,
      hiddenDays: 0,
      startsBeforeYear: false
    });
    expect(report.breakdowns).toEqual({ model: [], client: [], member: [] });
    expect(report.projection).toEqual({
      status: 'insufficient_data',
      baseline: null,
      growth: null,
      scenarios: null
    });
  });

  it('covers all of last year, without a projection', async () => {
    let scope = await readScope(org);
    let year = currentYear() - 1;
    let report = await agentTrackingSpendService.getReport({
      ...scope,
      year,
      timeZone: 'UTC'
    });

    expect(report.range).toMatchObject({
      timeZone: 'UTC',
      from: new Date(Date.UTC(year, 0, 1)),
      to: new Date(Date.UTC(year + 1, 0, 1))
    });
    expect(report.months).toHaveLength(12);
    expect(report.coverage.lastFullDay).toBe(`${year}-12-31`);
    expect(report.projection.status).toBe('not_applicable');
  });

  it('rejects a year to come, a year before last and an unknown time zone', async () => {
    let scope = await readScope(org);

    let year = currentYear();

    for (let input of [{ year: year + 1 }, { year: year - 2 }, { timeZone: 'Mars/Olympus' }]) {
      await expectServiceError(
        agentTrackingSpendService.getReport({ ...scope, ...input }),
        'bad_request'
      );
    }
  });
});

describe('module-agent-tracking-query spend report of usage over several days', () => {
  let org = useOrganization();

  let seededToday = startOfTodayUtc();
  let emails = [uniqueEmail('agent-tracking'), uniqueEmail('agent-tracking')];
  let seededDays = Array.from({ length: 8 }, (_, index) => seededToday - (8 - index) * dayMs);
  let requests = [
    ...seededDays.map((day, index) =>
      claudeRequest({
        sessionId: uniqueId('session'),
        email: emails[index % 2],
        at: new Date(day + 12 * hourMs),
        costUsd: 0.01
      })
    ),
    claudeRequest({
      sessionId: uniqueId('session'),
      at: new Date(seededToday - 2 * dayMs + 14 * hourMs),
      model: madeUpModel,
      costUsd: 0.002
    })
  ];

  let scope: Scope;

  beforeAll(async () => {
    await ingestFirstUsage(org, requests);
    scope = await readScope(org);
  }, 240_000);

  it('totals each month as the timeline totals its days, and the months add up to the year', async () => {
    let report = await agentTrackingSpendService.getReport(scope);
    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { from: report.range.from, to: report.range.to, timeZone: 'UTC' }
    });

    expect(report.total).toEqual(timeline.total);
    expect(report.counts).toEqual(timeline.counts);
    expect(report.total.requests).toBe(
      requests.filter(request => inYearOf(report, request.at)).length
    );

    for (let month of report.months) {
      let days = timeline.items.filter(item => item.date.startsWith(month.month));
      expect(month.requests).toBe(sumOf(days, day => day.requests ?? 0));
      expect(month.cost.totalMicros).toBe(sumOf(days, day => day.cost?.totalMicros ?? 0));
      expect(month.tokens.total).toBe(sumOf(days, day => day.tokens?.total ?? 0));
    }
    expect(sumOf(report.months, month => month.requests)).toBe(report.total.requests);
    expect(sumOf(report.months, month => month.cost.totalMicros ?? 0)).toBe(
      report.total.cost.totalMicros
    );
  });

  it('breaks the year down by model, client and member, each adding up to the year', async () => {
    let report = await agentTrackingSpendService.getReport(scope);

    for (let group of ['model', 'client', 'member'] as const) {
      let items = report.breakdowns[group]!;
      expect(sumOf(items, item => item.requests)).toBe(report.total.requests);
      expect(sumOf(items, item => item.cost.totalMicros ?? 0)).toBe(
        report.total.cost.totalMicros
      );
      expect(sumOf(items, item => item.share ?? 0)).toBeCloseTo(1, 6);
    }

    expect(report.breakdowns.client!.map(item => [item.kind, item.key, item.client])).toEqual([
      ['client', 'claude_code', { family: 'claude_code', name: 'Claude Code' }]
    ]);
    let members = report.breakdowns.member!.filter(item => item.kind == 'member');
    let senders = requests.filter(request => request.email && inYearOf(report, request.at));
    expect(members.map(item => item.member?.email).sort()).toEqual(
      [...new Set(senders.map(request => request.email))].sort()
    );

    let unknownModel = report.breakdowns.model!.find(item => item.kind == 'unknown');
    if (inYearOf(report, requests.at(-1)!.at)) {
      expect(unknownModel?.unknownModelNames).toContain(madeUpModel);
    }
  });

  it('says from which day the year has usage', async () => {
    let report = await agentTrackingSpendService.getReport(scope);
    let today = startOfTodayUtc();
    let dates = [...new Set(requests.map(request => isoDate(request.at)))].sort();
    let days = dates.filter(day => day.startsWith(`${report.year}-`));

    expect(report.coverage).toEqual({
      firstDay: days[0] ?? null,
      daysWithData: days.length,
      hiddenDays: 0,
      startsBeforeYear: dates.some(day => day.startsWith(`${report.year - 1}-12-`)),
      lastFullDay: isoDate(today).endsWith('-01-01') ? null : isoDate(today - dayMs)
    });
  });

  it('projects from the average of the complete days after the first once there are 7', async () => {
    let report = await agentTrackingSpendService.getReport(scope);
    let days = daysFrom(seededDays[1]!);

    expect(report.projection).toMatchObject({
      status: 'projected',
      baseline: {
        from: isoDate(seededDays[1]!),
        to: isoDate(startOfTodayUtc() - dayMs),
        days,
        dailyRateMicros: Math.round((7 * 10_000 + 2_000) / days)
      },
      growth: { rate: 0, source: 'default' }
    });

    let flat = report.projection.scenarios!.flat;
    let thisYearMonths = flat.months.filter(month =>
      month.month.startsWith(`${report.year}-`)
    );
    expect(flat.months[0]!.actualMicros).toBe(report.months.at(-1)!.cost.totalMicros);
    expect(flat.yearEndTotalMicros).toBe(
      report.total.cost.totalMicros! + sumOf(thisYearMonths, month => month.projectedMicros)
    );

    let growing = await agentTrackingSpendService.getReport({ ...scope, growthRate: 0.2 });
    expect(growing.projection.growth).toEqual({ rate: 0.2, source: 'input' });
    expect(growing.projection.scenarios!.flat).toEqual(flat);
    expect(growing.projection.scenarios!.growth.nextYearTotalMicros).toBeGreaterThan(
      flat.nextYearTotalMicros
    );
  });
});

describe('module-agent-tracking-query spend report with individuals hidden', () => {
  let org = useOrganization();

  let seededToday = startOfTodayUtc();
  let days = { crowded: seededToday - 2 * dayMs, alone: seededToday - hourMs };

  let scope: Scope;

  beforeAll(async () => {
    await ingestFirstUsage(org, [
      ...[1, 2, 3].map(index =>
        claudeRequest({
          email: uniqueEmail('agent-tracking'),
          at: new Date(days.crowded + 12 * hourMs + index * minuteMs)
        })
      ),
      claudeRequest({ email: uniqueEmail('agent-tracking'), at: new Date(days.alone) })
    ]);
    scope = await readScope(org);
  }, 240_000);

  it('does not project from fewer than 7 complete days', async () => {
    let report = await agentTrackingSpendService.getReport(scope);

    expect(report.projection).toEqual({
      status: 'insufficient_data',
      baseline: {
        from: isoDate(days.crowded + dayMs),
        to: isoDate(startOfTodayUtc() - dayMs),
        days: daysFrom(days.crowded) - 1,
        dailyRateMicros: null
      },
      growth: null,
      scenarios: null
    });
  });

  it('leaves out every list and counts whole UTC days without the small ones', async () => {
    await setPrivacy(org, { hideIndividuals: true, minGroupUsers: 3 });

    try {
      let report = await agentTrackingSpendService.getReport({
        ...scope,
        timeZone: 'Asia/Tokyo'
      });

      expect(report.breakdowns).toEqual({ model: null, client: null, member: null });
      expect(report.range).toMatchObject({ timeZone: 'UTC', to: new Date(startOfTodayUtc()) });
      expect(report.privacy).toEqual({
        hideIndividuals: true,
        minGroupUsers: 3,
        hiddenGroups: inYearOf(report, days.alone)
      });
      expect(report.coverage.hiddenDays).toBe(inYearOf(report, days.alone) ? 1 : 0);
      expect(report.total.requests).toBe(inYearOf(report, days.crowded) ? 3 : 0);
      if (inYearOf(report, days.alone)) expect(report.counts).toBeNull();
      expect(report.projection).toMatchObject({
        status: 'insufficient_data',
        baseline: { from: isoDate(days.crowded + dayMs), days: daysFrom(days.crowded) - 2 }
      });
    } finally {
      await setPrivacy(org, { hideIndividuals: false });
    }
  });
});
