import type { PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { lookupMembers, unique } from '../lib/members';
import { costOf, countOf } from '../lib/money';
import { pageByAnchor } from '../lib/pageByAnchor';
import { loadVisiblePrivacy } from '../lib/privacy';
import {
  memberWindowDays,
  membersQuery,
  sessionsWithCostColumn,
  sessionsWithListPriceColumn
} from '../lib/queries';
import {
  hasRange,
  normalizeRange,
  rangeCacheKey,
  resolveRange,
  type RangeInput
} from '../lib/range';
import { createRemotePaginator } from '../lib/remotePaginator';
import { cachedRead, runUsageQuery, type ReadScope } from '../lib/scope';
import { fromService } from '../lib/service';
import type { AgentTrackingMemberList, AgentTrackingSeenMember } from '../lib/types';

let dayMs = 24 * 60 * 60 * 1000;

class AgentTrackingMemberServiceImpl {
  async listMembers(
    d: ReadScope & { page: PaginatorInput; range?: RangeInput; memberIds?: string[] }
  ): Promise<AgentTrackingMemberList> {
    await loadVisiblePrivacy(d);

    let range = hasRange(d.range) ? normalizeRange(d.range) : undefined;
    let memberIds = d.memberIds ? unique(d.memberIds) : undefined;
    let now = new Date();

    let seen = await cachedRead({
      scope: d,
      read: 'members.seen',
      input: { range: range ? rangeCacheKey(range, now) : null, memberIds },
      load: async instanceId => {
        let lastActivity = range ? resolveRange(range, now) : undefined;
        let to = lastActivity && lastActivity.to < now ? lastActivity.to : now;

        // The sessions dataset is ranged by start, so the window reaches back as far as sessions
        // are kept and the range applies to their last activity, as in the session list.
        let result = await runUsageQuery(
          d,
          instanceId,
          membersQuery({
            window: { from: new Date(to.getTime() - memberWindowDays * dayMs), to },
            lastActivity,
            memberIds
          })
        );

        return {
          members: result.rows
            .filter(row => typeof row.user == 'string' && typeof row.last_activity == 'string')
            .map(row => ({
              id: row.user as string,
              lastSeenAt: new Date(row.last_activity as string),
              sessions: countOf(row.sessions),
              cost: costOf({
                total: row['cost.usd'],
                listPrice: row['cost.list'],
                reported: row['cost.reported'],
                unpriced: countOf(row[sessionsWithCostColumn]) == 0,
                unpricedAtListPrice: countOf(row[sessionsWithListPriceColumn]) == 0
              })
            })),
          truncated: result.meta.truncated
        };
      }
    });

    let paginator = createRemotePaginator<AgentTrackingSeenMember>(async page => {
      let slice = pageByAnchor(seen.members, page);
      let members = await fromService(() =>
        lookupMembers({ scope: d, ids: slice.items.map(item => item.id) })
      );

      return {
        ...slice,
        items: slice.items.map(item => ({
          ...members.get(item.id)!,
          lastSeenAt: item.lastSeenAt,
          sessions: item.sessions,
          cost: item.cost
        }))
      };
    });

    return { list: await paginator.run(d.page), truncated: seen.truncated };
  }
}

export let agentTrackingMemberService = Service.create(
  'agentTrackingMemberService',
  () => new AgentTrackingMemberServiceImpl()
).build();
