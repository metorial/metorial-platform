import {
  expectServiceError,
  firstPage,
  uniqueEmail,
  useOrganization,
  type BootstrappedOrganization
} from '@metorial/e2e';
import {
  agentTracking,
  claudeRequest,
  ingestFirstUsage,
  trackedInstance
} from '@metorial/agent-tracking-e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { agentTrackingSettingsService } from '@metorial/module-agent-tracking-sync';
import { describe, expect, it } from 'vitest';
import {
  agentTrackingFilterValueService,
  agentTrackingMemberInsightService,
  agentTrackingMemberService,
  agentTrackingSessionService,
  agentTrackingSpendService
} from '../src';
import { dayMs, isoDate, readScope } from './_fixtures';

let hourMs = 60 * 60 * 1000;

let individualsHidden = 'agent_tracking_individuals_hidden';

let startOfTodayUtc = () => new Date(`${isoDate(Date.now())}T00:00:00.000Z`);

let today = startOfTodayUtc().getTime();

let days = {
  crowded: isoDate(today - 2 * dayMs),
  alone: isoDate(today - hourMs)
};

let seed = async (org: BootstrappedOrganization) => {
  await ingestFirstUsage(org, [
    ...[1, 2, 3].map(index =>
      claudeRequest({
        email: uniqueEmail('agent-tracking'),
        at: new Date(today - 2 * dayMs + 12 * hourMs + index * 60_000)
      })
    ),
    claudeRequest({ email: uniqueEmail('agent-tracking'), at: new Date(today - hourMs) })
  ]);

  return await readScope(org);
};

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

let expectAllHidden = async (reads: (() => Promise<unknown>)[]) => {
  for (let read of reads) await expectServiceError(read(), individualsHidden);
};

let expectAllShown = async (reads: (() => Promise<unknown>)[]) => {
  for (let read of reads) await read();
};

describe('module-agent-tracking-query with individuals hidden: reads about one person', () => {
  let org = useOrganization();

  it('rejects every read about one person on the very next read after hiding them', async () => {
    let scope = await seed(org);
    let [session] = await firstPage(await agentTrackingSessionService.listSessions(scope));
    expect(session).toBeDefined();

    let personalReads = (): (() => Promise<unknown>)[] => [
      () => agentTrackingSpendService.getBreakdown({ ...scope, groupBy: 'member', range: {} }),
      () => agentTrackingSpendService.getBreakdown({ ...scope, groupBy: 'model', range: {} }),
      () => agentTrackingSessionService.listSessions(scope).run({ limit: 10 }),
      () =>
        agentTrackingSessionService
          .listSessions({ ...scope, orderBy: 'cost' })
          .run({ limit: 4 }),
      () => agentTrackingSessionService.getSession({ ...scope, sessionId: session!.id }),
      () =>
        agentTrackingFilterValueService.listFilterValues({
          ...scope,
          field: 'member',
          range: {}
        }),
      () => agentTrackingMemberService.listMembers({ ...scope, page: { limit: 10 } }),
      () =>
        agentTrackingMemberService.listMembers({
          ...scope,
          page: { limit: 10 },
          range: { preset: 'last_7_days' }
        }),
      () =>
        agentTrackingMemberInsightService.listMemberInsights({
          ...scope,
          page: { limit: 10 },
          include: ['models', 'practices', 'seat'],
          modelIds: ['claude-sonnet-4-5'],
          includeInactive: true
        }),
      () =>
        agentTrackingSpendService.getBreakdown({
          ...scope,
          groupBy: 'model',
          range: {},
          filters: { memberIds: [session!.member!.id] }
        }),
      () =>
        agentTrackingFilterValueService.listFilterValues({
          ...scope,
          field: 'seat',
          range: {}
        })
    ];

    await expectAllShown(personalReads());

    await setPrivacy(org, { hideIndividuals: true, minGroupUsers: 3 });
    await expectAllHidden(personalReads());

    await setPrivacy(org, { hideIndividuals: false });
    await expectAllShown(personalReads());
  }, 240_000);
});

describe('module-agent-tracking-query with individuals hidden: filters and ranges', () => {
  let org = useOrganization();

  it('rejects filters, filter values, explicit ranges and today, and answers whole UTC days', async () => {
    let scope = await seed(org);

    let filterAndRangeReads = (): (() => Promise<unknown>)[] => [
      () =>
        agentTrackingSpendService.getTimeline({
          ...scope,
          range: {},
          filters: { modelIds: ['claude-sonnet-4-5'] }
        }),
      () =>
        agentTrackingSpendService.getTimeline({
          ...scope,
          range: {},
          filters: { clientFamilies: ['claude_code'] }
        }),
      () =>
        agentTrackingSpendService.getBreakdown({
          ...scope,
          groupBy: 'model',
          range: {},
          filters: { modelIds: ['claude-sonnet-4-5'] }
        }),
      () =>
        agentTrackingFilterValueService.listFilterValues({
          ...scope,
          field: 'model',
          range: {}
        }),
      () =>
        agentTrackingFilterValueService.listFilterValues({
          ...scope,
          field: 'client',
          range: {}
        }),
      () => agentTrackingSpendService.getTimeline({ ...scope, range: { preset: 'today' } }),
      () =>
        agentTrackingSpendService.getBreakdown({
          ...scope,
          groupBy: 'model',
          range: { preset: 'today' }
        }),
      () =>
        agentTrackingSpendService.getTimeline({
          ...scope,
          range: {
            from: new Date(Date.now() - 3 * hourMs),
            to: new Date(Date.now() - hourMs)
          }
        })
    ];

    await expectAllShown(filterAndRangeReads());

    await setPrivacy(org, { hideIndividuals: true, minGroupUsers: 3 });
    await expectAllHidden(filterAndRangeReads());

    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_7_days', timeZone: 'Asia/Tokyo' }
    });
    expect(timeline.range).toMatchObject({ timeZone: 'UTC', to: startOfTodayUtc() });
    expect(timeline.items).toHaveLength(7);
    expect(timeline.items[6]!.date).toBe(days.alone);
  }, 240_000);
});

describe('module-agent-tracking-query with individuals hidden: small days', () => {
  let org = useOrganization();

  it('hides a day with fewer people than the minimum even when the engine would show it, and sums only the shown days', async () => {
    let scope = await seed(org);

    await setPrivacy(org, { hideIndividuals: true, minGroupUsers: 3 });
    await agentTracking().organization.upsert({
      ref: org.ids.organizationId,
      settings: { privacy: { hideIndividuals: false, minGroupUsers: 3 } }
    });

    let engine = await agentTracking().query.run({
      organizationId: org.ids.organizationId,
      scope: { instanceIds: [(await trackedInstance(org.ids)).id] },
      query: {
        atq: '0',
        dataset: 'usage',
        range: {
          from: `${days.crowded}T00:00:00.000Z`,
          to: startOfTodayUtc().toISOString()
        },
        timeZone: 'UTC',
        dimensions: ['time.day'],
        measures: ['requests'],
        labels: false
      }
    });
    expect(engine.rows.map((row: any) => row.requests)).toEqual([3, 1]);

    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_7_days' }
    });
    expect(timeline.privacy).toEqual({
      hideIndividuals: true,
      minGroupUsers: 3,
      hiddenGroups: true
    });
    expect(timeline.items.filter(item => item.hidden).map(item => item.date)).toEqual([
      days.alone
    ]);
    expect(timeline.items.find(item => item.date == days.alone)).toMatchObject({
      cost: null,
      requests: null,
      tokens: null,
      counts: null
    });
    expect(timeline.items.find(item => item.date == days.crowded)).toMatchObject({
      hidden: false,
      requests: 3,
      cost: { totalMicros: 37500 },
      counts: { sessions: 3, members: 3 }
    });
    expect(timeline.total).toMatchObject({ requests: 3, cost: { totalMicros: 37500 } });
    expect(timeline.counts).toBeNull();
    expect(timeline.previous.total.requests).toBe(0);
    expect(timeline.previous.hiddenGroups).toBe(false);

    await expectServiceError(
      agentTrackingSpendService.getBreakdown({
        ...scope,
        groupBy: 'model',
        range: { preset: 'last_7_days' }
      }),
      individualsHidden
    );

    await setPrivacy(org, { hideIndividuals: false, minGroupUsers: 5 });

    let restored = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_7_days' }
    });
    expect(restored.total.requests).toBe(4);
    expect(restored.items.find(item => item.date == days.alone)).toMatchObject({
      hidden: false,
      requests: 1
    });
  }, 240_000);
});
