import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { agentTrackingMemberType } from '../../types';
import {
  agentTrackingMemberProperties,
  presentAgentTrackingMember
} from './agentTrackingCommon';

export let v1AgentTrackingMemberPresenter = Presenter.create(agentTrackingMemberType)
  .presenter(async ({ member, listTruncated }) => ({
    ...presentAgentTrackingMember(member),
    last_seen_at: member.lastSeenAt,
    sessions: member.sessions,
    list_truncated: listTruncated
  }))
  .schema(
    v.object(
      {
        ...agentTrackingMemberProperties,
        last_seen_at: v.date({
          name: 'last_seen_at',
          description: 'When a session of this member was last active in this instance.'
        }),
        sessions: v.number({
          name: 'sessions',
          description: 'Sessions of this member in this instance in the last 400 days.'
        }),
        list_truncated: v.boolean({
          name: 'list_truncated',
          description:
            'Whether more than 1000 members sent usage, in which case only the 1000 most recently active are listed. The same for every member of a list.'
        })
      },
      { name: 'member', description: 'A person who has sent usage to this instance.' }
    )
  )
  .build();
