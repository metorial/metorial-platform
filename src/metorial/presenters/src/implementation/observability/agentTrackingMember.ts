import { v } from '@lowerdeck/validation';
import { maxMembers, memberWindowDays } from '@metorial/module-agent-tracking-query';
import { Presenter } from '@metorial/presenter';
import { agentTrackingMemberType } from '../../types';
import {
  agentTrackingCostSchema,
  agentTrackingMemberProperties,
  presentAgentTrackingCost,
  presentAgentTrackingMember
} from './agentTrackingCommon';

export let v1AgentTrackingMemberPresenter = Presenter.create(agentTrackingMemberType)
  .presenter(async ({ member, listTruncated }) => ({
    ...presentAgentTrackingMember(member),
    last_seen_at: member.lastSeenAt,
    sessions: member.sessions,
    cost: presentAgentTrackingCost(member.cost),
    list_truncated: listTruncated
  }))
  .schema(
    v.object(
      {
        ...agentTrackingMemberProperties,
        last_seen_at: v.date({
          name: 'last_seen_at',
          description: 'When the latest of the sessions counted in sessions was last active.'
        }),
        sessions: v.number({
          name: 'sessions',
          description: `Sessions of this member in this instance last active in the requested range, or in the last ${memberWindowDays} days without one.`
        }),
        cost: agentTrackingCostSchema,
        list_truncated: v.boolean({
          name: 'list_truncated',
          description: `Whether more than ${maxMembers} members sent usage, in which case only the ${maxMembers} most recently active are listed. The same for every member of a list.`
        })
      },
      { name: 'member', description: 'A person who has sent usage to this instance.' }
    )
  )
  .build();
