import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { agentTrackingSpendBreakdownType, agentTrackingSpendTimelineType } from '../../types';
import {
  agentTrackingMemberSchema,
  agentTrackingModelSchema,
  agentTrackingRangeSchema,
  agentTrackingSpendFiguresProperties,
  agentTrackingUnknownModelNamesSchema,
  presentAgentTrackingMember,
  presentAgentTrackingRange,
  presentAgentTrackingSpendCost,
  presentAgentTrackingTokens
} from './agentTrackingCommon';

type Figures = {
  cost: Parameters<typeof presentAgentTrackingSpendCost>[0];
  requests: number;
  tokens: Parameters<typeof presentAgentTrackingTokens>[0];
};

let presentFigures = (figures: Figures) => ({
  cost: presentAgentTrackingSpendCost(figures.cost),
  requests: figures.requests,
  tokens: presentAgentTrackingTokens(figures.tokens)
});

let totalSchema = v.object(agentTrackingSpendFiguresProperties, {
  name: 'total',
  description:
    'The figures for the whole range. When the organization hides individual data, the sum over the shown days only.'
});

let presentPrivacy = (privacy: {
  hideIndividuals: boolean;
  minGroupUsers: number;
  hiddenGroups: boolean;
}) => ({
  hide_individuals: privacy.hideIndividuals,
  min_group_users: privacy.minGroupUsers,
  hidden_groups: privacy.hiddenGroups
});

export let v1AgentTrackingSpendTimelinePresenter = Presenter.create(
  agentTrackingSpendTimelineType
)
  .presenter(async ({ timeline }) => ({
    object: 'agent_tracking.spend_timeline' as const,

    range: presentAgentTrackingRange(timeline.range),
    interval: timeline.interval,
    total: presentFigures(timeline.total),
    counts: timeline.counts
      ? {
          sessions: timeline.counts.sessions,
          members: timeline.counts.members,
          capped: timeline.counts.capped
        }
      : null,
    previous: {
      range: presentAgentTrackingRange(timeline.previous.range),
      total: presentFigures(timeline.previous.total),
      starts_before_retention: timeline.previous.startsBeforeRetention,
      hidden_groups: timeline.previous.hiddenGroups
    },
    privacy: presentPrivacy(timeline.privacy),

    items: timeline.items.map(item => ({
      date: item.date,
      starts_at: item.startsAt,
      hidden: item.hidden,
      cost: item.cost ? presentAgentTrackingSpendCost(item.cost) : null,
      requests: item.requests,
      tokens: item.tokens ? presentAgentTrackingTokens(item.tokens) : null,
      counts: item.counts
        ? { sessions: item.counts.sessions, members: item.counts.members }
        : null
    }))
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.spend_timeline', {
        description: "String representing the object's type"
      }),

      range: agentTrackingRangeSchema,
      interval: v.literal('day', {
        description: 'The length of each item. Always day.'
      }),
      total: totalSchema,
      counts: v.nullable(
        v.object(
          {
            sessions: v.number({
              name: 'sessions',
              description:
                'Sessions with usage in the range that the filters select, including sessions that started before it. Usage is any model request, token or nonzero cost; a session that only started counts once it has some.'
            }),
            members: v.number({
              name: 'members',
              description:
                'Distinct members with usage in the range that the filters select, usage counted as for sessions. Usage without a member (Unknown Member) is not counted.'
            }),
            capped: v.boolean({
              name: 'capped',
              description:
                'Whether a count reached 10000, where counting stops. The count is then at least the number shown.'
            })
          },
          {
            name: 'counts',
            description:
              'How many sessions and members the range covers. Null when the organization hides individual data and a day of the range is hidden: distinct counts cannot be limited to the shown days.'
          }
        )
      ),
      previous: v.object(
        {
          range: agentTrackingRangeSchema,
          total: v.object(agentTrackingSpendFiguresProperties, {
            name: 'total',
            description:
              'The figures for the whole previous period. When the organization hides individual data, the sum over its shown days only, counted like total.'
          }),
          hidden_groups: v.boolean({
            name: 'hidden_groups',
            description:
              'Whether days of the previous period are hidden, so its total covers only the days shown and does not compare with the range total.'
          }),
          starts_before_retention: v.boolean({
            name: 'starts_before_retention',
            description:
              'Whether the previous period starts before the 400 days usage is kept, so its total covers less than the whole period.'
          })
        },
        {
          name: 'previous',
          description:
            'The period before the range, for comparison. For today: yesterday up to the same time of day. For month_to_date: last month up to the same day and time, or all of last month when it is shorter. For last_month: the month before it. Otherwise the period of the same length that ends where the range starts. Its range has no preset.'
        }
      ),
      privacy: v.object(
        {
          hide_individuals: v.boolean({
            name: 'hide_individuals',
            description: 'Whether the organization hides individual data.'
          }),
          min_group_users: v.number({
            name: 'min_group_users',
            description:
              'With hide_individuals, the fewest people a group must have to be shown.',
            examples: [5]
          }),
          hidden_groups: v.boolean({
            name: 'hidden_groups',
            description:
              'Whether some days are hidden because fewer people than min_group_users had usage on them. With individuals hidden, days are whole days in UTC ending with yesterday, and only presets other than today are accepted.'
          })
        },
        {
          name: 'privacy',
          description: 'The privacy settings the figures were computed under.'
        }
      ),

      items: v.array(
        v.object({
          date: v.string({
            name: 'date',
            description: 'The calendar day in the range time zone, as YYYY-MM-DD.',
            examples: ['2026-11-12']
          }),
          starts_at: v.date({
            name: 'starts_at',
            description:
              'When the day starts in the range time zone. With an explicit range that does not start or end at midnight, the first and last day hold only the usage inside the range.'
          }),
          hidden: v.boolean({
            name: 'hidden',
            description:
              'Whether the day is hidden because fewer people than privacy.min_group_users had usage on it. A hidden day has null cost, requests, tokens and counts: its usage is not known to be zero.'
          }),
          cost: v.nullable(agentTrackingSpendFiguresProperties.cost),
          requests: v.nullable(agentTrackingSpendFiguresProperties.requests),
          tokens: v.nullable(agentTrackingSpendFiguresProperties.tokens),
          counts: v.nullable(
            v.object(
              {
                sessions: v.number({
                  name: 'sessions',
                  description:
                    'Sessions with usage on the day, counted like counts.sessions of the range. A session with usage on several days counts on each, so the days can add up to more than the range count.'
                }),
                members: v.number({
                  name: 'members',
                  description:
                    'Distinct members with usage on the day, counted like counts.members of the range. A member with usage on several days counts on each, so the days can add up to more than the range count.'
                })
              },
              {
                name: 'counts',
                description:
                  'How many sessions and members were active on the day. Whether a count is capped is reported once, in counts.capped of the range.'
              }
            )
          )
        }),
        {
          name: 'items',
          description:
            'One item per day of the range, oldest first, including days without usage (zero) and hidden days.'
        }
      )
    })
  )
  .build();

export let v1AgentTrackingSpendBreakdownPresenter = Presenter.create(
  agentTrackingSpendBreakdownType
)
  .presenter(async ({ breakdown }) => ({
    object: 'agent_tracking.spend_breakdown' as const,

    range: presentAgentTrackingRange(breakdown.range),
    group_by: breakdown.groupBy,
    total: presentFigures(breakdown.total),

    items: breakdown.items.map(item => ({
      kind: item.kind,
      key: item.key,
      member: item.member ? presentAgentTrackingMember(item.member) : null,
      model: item.model ? { id: item.model.id, name: item.model.name } : null,
      unknown_model_names: item.unknownModelNames,
      share: item.share,
      ...presentFigures(item)
    }))
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.spend_breakdown', {
        description: "String representing the object's type"
      }),

      range: agentTrackingRangeSchema,
      group_by: v.enumOf(['member', 'model'], {
        name: 'group_by',
        description: 'What the items are grouped by.'
      }),
      total: totalSchema,

      items: v.array(
        v.object({
          kind: v.enumOf(['member', 'model', 'unknown', 'other'], {
            name: 'kind',
            description:
              'member or model for a group; unknown for usage without a member (Unknown Member) or whose model is not matched to the model catalog (Unknown Model, see unknown_model_names); other for everything past the top 10, added up.'
          }),
          key: v.string({
            name: 'key',
            description:
              'The member or model id, unknown, or other. Unique within the breakdown.',
            examples: ['aten_0mhNnEqM7XQb3vXq8gD2', 'unknown', 'other']
          }),
          member: v.nullable(agentTrackingMemberSchema),
          model: v.nullable(agentTrackingModelSchema),
          unknown_model_names: agentTrackingUnknownModelNamesSchema(
            'On the unknown item of a breakdown by model: the models that make it up, most requests first, at most 10. Empty on every other item and in a breakdown by member.'
          ),
          share: v.nullable(
            v.number({
              name: 'share',
              description:
                'The share of the total cost, from 0 to 1. Null when the total cost is zero or unknown.'
            })
          ),
          ...agentTrackingSpendFiguresProperties
        }),
        {
          name: 'items',
          description:
            'The top 10 groups by cost, most expensive first (ties ordered by key), then one other item when there are more. Groups without requests, tokens or cost are left out.'
        }
      )
    })
  )
  .build();
