import type { PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { lookupMembers } from '../lib/members';
import { countOf } from '../lib/money';
import { pageByAnchor } from '../lib/pageByAnchor';
import { loadVisiblePrivacy } from '../lib/privacy';
import { memberWindowDays, membersQuery } from '../lib/queries';
import { createRemotePaginator } from '../lib/remotePaginator';
import {
  cachedRead,
  resolveServiceInstanceId,
  runUsageQuery,
  type ReadScope
} from '../lib/scope';
import { fromService } from '../lib/service';
import type { AgentTrackingMemberList, AgentTrackingSeenMember } from '../lib/types';

let dayMs = 24 * 60 * 60 * 1000;

class AgentTrackingMemberServiceImpl {
  async listMembers(
    d: ReadScope & { page: PaginatorInput }
  ): Promise<AgentTrackingMemberList> {
    await loadVisiblePrivacy(d);

    let seen = await cachedRead({
      scope: d,
      read: 'members.seen',
      load: async () => {
        let now = new Date();
        let instanceId = await resolveServiceInstanceId(d);

        let result = await runUsageQuery(
          d,
          instanceId,
          membersQuery({ from: new Date(now.getTime() - memberWindowDays * dayMs), to: now })
        );

        return {
          members: result.rows
            .filter(row => typeof row.user == 'string' && typeof row.last_activity == 'string')
            .map(row => ({
              id: row.user as string,
              lastSeenAt: new Date(row.last_activity as string),
              sessions: countOf(row.sessions)
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
          sessions: item.sessions
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
