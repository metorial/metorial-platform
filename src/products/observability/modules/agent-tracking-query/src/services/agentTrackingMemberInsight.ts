import type { PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { lookupModelNames } from '../lib/catalog';
import {
  assertInsightsInput,
  buildMemberInsights,
  expandMemberInsights,
  flagCountsOf,
  normalizeInclude,
  rankMemberInsights
} from '../lib/memberInsights';
import { unique } from '../lib/entities';
import { instanceConsumerMemberIds, lookupMembers } from '../lib/members';
import { pageByAnchor } from '../lib/pageByAnchor';
import { loadVisibleSettings } from '../lib/privacy';
import {
  assertRecordRange,
  lastActivityQuery,
  memberInsightsRequestsQuery,
  memberInsightsUsageQuery,
  outdatedModelsQuery
} from '../lib/queries';
import {
  normalizeRange,
  rangeCacheKey,
  resolveRange,
  type NormalizedRange,
  type RangeInput
} from '../lib/range';
import { createRemotePaginator } from '../lib/remotePaginator';
import { cachedRead, runUsageQueries, type ReadScope } from '../lib/scope';
import { fromService } from '../lib/service';
import type {
  AgentTrackingMemberInsight,
  AgentTrackingMemberInsights,
  MemberInsightsGroup,
  MemberInsightsSort,
  MemberInsightsThresholds
} from '../lib/types';

class AgentTrackingMemberInsightServiceImpl {
  async listMemberInsights(
    d: ReadScope & {
      page: PaginatorInput;
      range?: RangeInput;
      include?: MemberInsightsGroup[];
      modelIds?: string[];
      seats?: string[];
      includeInactive?: boolean;
      sort?: MemberInsightsSort;
      thresholds?: MemberInsightsThresholds;
      flaggedOnly?: boolean;
    }
  ): Promise<AgentTrackingMemberInsights> {
    await loadVisibleSettings(d);

    let include = normalizeInclude(d.include);
    let sort = d.sort ?? 'cost';
    let thresholds = d.thresholds ?? {};
    let modelIds = d.modelIds ? unique(d.modelIds) : undefined;
    let seats = d.seats ? unique(d.seats) : undefined;
    let includeInactive = d.includeInactive ?? false;
    assertInsightsInput({ include, sort, thresholds, modelIds, seats });

    let range = normalizeRange(d.range ?? {});
    let now = new Date();
    if (include.includes('practices') || include.includes('seat')) {
      assertRecordRange(resolveRange(range, now), 'Practices and seat');
    }

    let data = await cachedRead({
      scope: d,
      read: 'members.insights',
      input: { range: rangeCacheKey(range, now), include, modelIds, includeInactive },
      load: () => this.load({ scope: d, range, now, include, modelIds, includeInactive })
    });

    let ranked = rankMemberInsights({
      rows: expandMemberInsights(data),
      sort,
      order: d.page.order ?? 'desc',
      thresholds,
      seats
    });
    let shown = d.flaggedOnly ? ranked.filter(row => row.flags.length) : ranked;

    let paginator = createRemotePaginator<AgentTrackingMemberInsight>(async page => {
      let slice = pageByAnchor(shown, { ...page, order: 'desc' });
      let [members, modelNames] = await Promise.all([
        fromService(() => lookupMembers({ scope: d, ids: slice.items.map(item => item.id) })),
        lookupModelNames(
          slice.items.flatMap(
            item => item.practices?.outdatedModels.map(outdated => outdated.model.id) ?? []
          )
        )
      ]);

      return {
        ...slice,
        items: slice.items.map(item => ({
          ...item,
          member: members.get(item.id)!,
          practices: item.practices && {
            ...item.practices,
            outdatedModels: item.practices.outdatedModels.map(outdated => ({
              ...outdated,
              model: { id: outdated.model.id, name: modelNames.get(outdated.model.id) ?? null }
            }))
          }
        }))
      };
    });

    return {
      range: data.range,
      include,
      list: await paginator.run(d.page),
      truncated: data.truncated,
      summary: {
        ...data.summary,
        members: ranked.length,
        flagCounts: flagCountsOf(ranked, thresholds),
        seat: include.includes('seat')
          ? { unknownSeatMembers: ranked.filter(row => !row.seat?.seat).length }
          : null
      }
    };
  }

  private async load(d: {
    scope: ReadScope;
    range: NormalizedRange;
    now: Date;
    include: MemberInsightsGroup[];
    modelIds: string[] | undefined;
    includeInactive: boolean;
  }) {
    let resolved = resolveRange(d.range, d.now);
    let practices = d.include.includes('practices');
    let seat = d.include.includes('seat');

    let [usage, lastActivity, requests, outdated] = await runUsageQueries(d.scope, [
      memberInsightsUsageQuery({ range: resolved, modelIds: d.modelIds, practices }),
      lastActivityQuery(d.now),
      practices || seat
        ? memberInsightsRequestsQuery({ range: resolved, practices, seat })
        : null,
      practices ? outdatedModelsQuery(resolved) : null
    ]);

    let inactive =
      d.includeInactive && !d.include.includes('models')
        ? await fromService(() => instanceConsumerMemberIds({ scope: d.scope }))
        : null;

    return buildMemberInsights({
      range: resolved,
      now: d.now,
      include: d.include,
      usage: usage!,
      lastActivity: lastActivity!,
      requests: requests ?? null,
      outdated: outdated ?? null,
      inactive
    });
  }
}

export let agentTrackingMemberInsightService = Service.create(
  'agentTrackingMemberInsightService',
  () => new AgentTrackingMemberInsightServiceImpl()
).build();
