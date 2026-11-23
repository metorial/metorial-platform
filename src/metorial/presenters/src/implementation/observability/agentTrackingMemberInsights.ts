import { v } from '@lowerdeck/validation';
import {
  maxDistinctCount,
  maxInsightMembers,
  memberInsightsFlags,
  memberInsightsGroups,
  memberWindowDays,
  outdatedModelStatuses,
  requestRecordDays,
  type AgentTrackingModelUsageFigures,
  type AgentTrackingPracticeFigures
} from '@metorial/module-agent-tracking-query';
import { Presenter } from '@metorial/presenter';
import { agentTrackingMemberInsightsType } from '../../types';
import {
  agentTrackingMemberSchema,
  agentTrackingModelSchema,
  agentTrackingNullableMicrosSchema,
  agentTrackingRangeSchema,
  agentTrackingSpendCostSchema,
  presentAgentTrackingMember,
  presentAgentTrackingRange,
  presentAgentTrackingSpendCost
} from './agentTrackingCommon';

let share = (name: string, description: string) =>
  v.nullable(v.number({ name, description: `${description} From 0 to 1.` }));

let outdatedStatuses = outdatedModelStatuses.map(status => `\`${status}\``).join(' or ');

let count = (name: string, description: string) => v.number({ name, description });

let flagCount = (flag: (typeof memberInsightsFlags)[number]) =>
  v.nullable(
    v.number({
      name: flag,
      description: `Members with the \`${flag}\` flag. \`null\` when its threshold was not passed.`
    })
  );

let catalogNote =
  'Model status and latest come from the current model catalog, not from when the requests were made.';

let requestsNote = `Counted from request records, which are kept for ${requestRecordDays} days and can differ slightly from requests counted from usage.`;

let modelUsageSchema = (description: string) =>
  v.nullable(
    v.object(
      {
        cost_micros: agentTrackingNullableMicrosSchema(
          'cost_micros',
          'The cost of the selected models, on the same basis as `cost.total_micros`. `null` when no cost is known.'
        ),
        requests: count('requests', 'Model requests to the selected models.'),
        cost_share: share(
          'cost_share',
          '`cost_micros` as a share of the whole cost. `null` when the whole cost is zero or unknown.'
        ),
        request_share: share(
          'request_share',
          '`requests` as a share of all requests. `null` when there were no requests.'
        )
      },
      { name: 'models', description }
    )
  );

let practiceProperties = {
  requests_measured: count(
    'requests_measured',
    `Model requests in the range. ${requestsNote}`
  ),
  requests_with_effort: count(
    'requests_with_effort',
    'Requests in `requests_measured` that reported a reasoning effort.'
  ),
  high_effort_requests: count(
    'high_effort_requests',
    'Requests at the `high` reasoning effort, not counting `max`.'
  ),
  max_effort_requests: count('max_effort_requests', 'Requests at the `max` reasoning effort.'),
  high_effort_share: share(
    'high_effort_share',
    '`high_effort_requests` plus `max_effort_requests` as a share of `requests_with_effort`. `null` when no request reported a reasoning effort.'
  ),
  fast_requests: count('fast_requests', 'Requests in the fast speed tier.'),
  fast_share: share(
    'fast_share',
    '`fast_requests` as a share of all of `requests_measured`, counting requests that reported no speed tier as not fast. `null` when no request reported a speed tier: agents send it only in some setups, so its absence does not show the requests were not fast.'
  ),
  outdated_cost_micros: agentTrackingNullableMicrosSchema(
    'outdated_cost_micros',
    `The cost on models whose status is ${outdatedStatuses}. ${catalogNote} \`null\` when no cost is known.`
  ),
  outdated_share: share(
    'outdated_share',
    '`outdated_cost_micros` as a share of the whole cost. `null` when the whole cost is zero or unknown.'
  ),
  cache_hit_rate: share(
    'cache_hit_rate',
    'Input tokens read from the prompt cache as a share of all input tokens. `null` without usage or input tokens.'
  )
};

let presentModelUsage = (models: AgentTrackingModelUsageFigures | null) =>
  models && {
    cost_micros: models.costMicros,
    requests: models.requests,
    cost_share: models.costShare,
    request_share: models.requestShare
  };

let presentPractices = (practices: AgentTrackingPracticeFigures) => ({
  requests_measured: practices.requestsMeasured,
  requests_with_effort: practices.requestsWithEffort,
  high_effort_requests: practices.highEffortRequests,
  max_effort_requests: practices.maxEffortRequests,
  high_effort_share: practices.highEffortShare,
  fast_requests: practices.fastRequests,
  fast_share: practices.fastShare,
  outdated_cost_micros: practices.outdatedCostMicros,
  outdated_share: practices.outdatedShare,
  cache_hit_rate: practices.cacheHitRate
});

export let v1AgentTrackingMemberInsightsPresenter = Presenter.create(
  agentTrackingMemberInsightsType
)
  .presenter(async ({ insights }) => ({
    object: 'agent_tracking.member_insights' as const,

    range: presentAgentTrackingRange(insights.range),
    include: insights.include,
    truncated: insights.truncated,

    items: insights.list.items.map(item => ({
      member: presentAgentTrackingMember(item.member),
      rank: item.rank,
      cost: presentAgentTrackingSpendCost(item.cost),
      share: item.share,
      sessions: item.sessions,
      requests: item.requests,
      last_activity_at: item.lastActivityAt,
      models: presentModelUsage(item.models),
      practices: item.practices && {
        ...presentPractices(item.practices),
        outdated_models: item.practices.outdatedModels.map(outdated => ({
          model: { id: outdated.model.id, name: outdated.model.name },
          status: outdated.status,
          is_latest: outdated.isLatest,
          cost_micros: outdated.costMicros
        }))
      },
      seat: item.seat && {
        seat: item.seat.seat,
        plan: item.seat.plan,
        list_price_micros: item.seat.listPriceMicros
      },
      flags: item.flags
    })),
    pagination: {
      has_more_after: insights.list.pagination.hasNextPage,
      has_more_before: insights.list.pagination.hasPreviousPage,
      ...(insights.list.pagination.after ? { after: insights.list.pagination.after } : {}),
      ...(insights.list.pagination.before ? { before: insights.list.pagination.before } : {})
    },

    summary: {
      cost: presentAgentTrackingSpendCost(insights.summary.cost),
      requests: insights.summary.requests,
      sessions: insights.summary.sessions,
      active_members: insights.summary.activeMembers,
      counts_capped: insights.summary.countsCapped,
      unattributed_cost_micros: insights.summary.unattributedCostMicros,
      members: insights.summary.members,
      flag_counts: insights.summary.flagCounts,
      models: presentModelUsage(insights.summary.models),
      practices: insights.summary.practices && presentPractices(insights.summary.practices),
      seat: insights.summary.seat && {
        unknown_seat_members: insights.summary.seat.unknownSeatMembers
      },
      request_records_clipped: insights.summary.requestRecordsClipped
    }
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.member_insights', {
        description: 'String representing the object’s type.'
      }),

      range: agentTrackingRangeSchema,
      include: v.array(v.enumOf(memberInsightsGroups), {
        name: 'include',
        description:
          'The column groups computed: `models`, `practices` and `seat` are `null` on every item unless listed here.'
      }),
      truncated: v.boolean({
        name: 'truncated',
        description: `Whether the list is incomplete: more than ${maxInsightMembers} members had usage (the least expensive are left out), members without usage asked for with \`include_inactive\` did not all fit in the room left, or a figure behind the list hit a limit. \`rank\`, \`summary.members\` and \`summary.flag_counts\` then cover only the members listed. The instance totals in \`summary\` are not affected.`
      }),

      items: v.array(
        v.object({
          member: agentTrackingMemberSchema,
          rank: count(
            'rank',
            'The position of the member in the whole list in the requested sort and order, from 1. Ties are ordered by member id. Members without a value for the sort come last. `flagged_only` does not change it.'
          ),
          cost: agentTrackingSpendCostSchema,
          share: share(
            'share',
            "The member's share of the instance's cost in the range, including usage without a member. `null` when that cost is zero or unknown."
          ),
          sessions: count('sessions', 'Sessions with usage of this member in the range.'),
          requests: count('requests', 'Model requests of this member in the range.'),
          last_activity_at: v.nullable(
            v.date({
              name: 'last_activity_at',
              description:
                'When a session of this member was last active, at any time, not only in the range. `null` when it is not known.'
            })
          ),
          models: modelUsageSchema(
            "The member's usage of the models in `model_id`. `null` unless `include` has `models`."
          ),
          practices: v.nullable(
            v.object(
              {
                ...practiceProperties,
                outdated_models: v.array(
                  v.object({
                    model: agentTrackingModelSchema,
                    status: v.nullable(
                      v.string({
                        name: 'status',
                        description: `The lifecycle status in the model catalog: \`preview\`, \`active\`, \`deprecated\` or \`retired\`. ${catalogNote}`,
                        examples: ['deprecated']
                      })
                    ),
                    is_latest: v.nullable(
                      v.boolean({
                        name: 'is_latest',
                        description: `Whether the model is the latest of its family. ${catalogNote}`
                      })
                    ),
                    cost_micros: agentTrackingNullableMicrosSchema(
                      'cost_micros',
                      'The cost of this member on the model in the range. `null` when no cost is known.'
                    )
                  }),
                  {
                    name: 'outdated_models',
                    description: `Up to 3 models this member used in the range that are ${outdatedStatuses}, or not the latest of their family, most expensive first.`
                  }
                )
              },
              {
                name: 'practices',
                description:
                  'How the member uses the agents: reasoning effort, speed tier, outdated models and the prompt cache. `null` unless `include` has `practices`.'
              }
            )
          ),
          seat: v.nullable(
            v.object(
              {
                seat: v.nullable(
                  v.string({
                    name: 'seat',
                    description:
                      'The seat type of the seat and plan pair the agent reported most often on this member’s requests in the range, as reported, such as `standard` or `premium`. Ties go to the first alphabetically. These are the values parsed from each request and can differ from the billing plan derived for usage. `null` when no request reported one.',
                    examples: ['premium']
                  })
                ),
                plan: v.nullable(
                  v.string({
                    name: 'plan',
                    description:
                      'The billing plan reported together with `seat`. When no request reported a seat, the plan reported most often, ties going to the first alphabetically. As reported on each request, so it can differ from the billing plan derived for usage. `null` when no request reported one.',
                    examples: ['max']
                  })
                ),
                list_price_micros: agentTrackingNullableMicrosSchema(
                  'list_price_micros',
                  "The member's usage in the range at list prices, the same as `cost.list_price_micros`. `0` without usage. `null` when the member had requests and none of them had a list price."
                )
              },
              {
                name: 'seat',
                description: `The seat of the member and how much of it was used. \`null\` unless \`include\` has \`seat\`. Seat and plan come from request records, which are kept for ${requestRecordDays} days.`
              }
            )
          ),
          flags: v.array(v.enumOf(memberInsightsFlags), {
            name: 'flags',
            description:
              'The flags whose threshold was passed and that this member meets. `model_share`: `models.cost_share` at least `model_share_min`. `high_effort`, `fast_mode`, `outdated_models`: `practices.high_effort_share`, `fast_share` or `outdated_share` at least the matching `_min`. `low_cache_hit_rate`: `practices.cache_hit_rate` below `cache_hit_rate_max`. `low_usage_seat`: `seat.list_price_micros` below `seat_usage_max_micros` and, when `seat` is passed, a seat among them. Members without usage only ever get `low_usage_seat`.'
          })
        }),
        {
          name: 'items',
          description: `Members with usage in the range, in the requested sort and order. With \`include_inactive\` also the members without usage that had a session in this instance in the last ${memberWindowDays} days or are a consumer of it. Usage without a member is left out; see \`summary.unattributed_cost_micros\`.`
        }
      ),
      pagination: v.object(
        {
          has_more_after: v.boolean({
            name: 'has_more_after',
            description: 'Whether more items follow this page.'
          }),
          has_more_before: v.boolean({
            name: 'has_more_before',
            description: 'Whether items precede this page.'
          }),
          after: v.optional(
            v.string({
              name: 'after',
              description: 'Pass as `after` to get the next page. Missing on the last page.'
            })
          ),
          before: v.optional(
            v.string({
              name: 'before',
              description:
                'Pass as `before` to get the previous page. Missing on the first page.'
            })
          )
        },
        { name: 'pagination', description: 'Where this page sits in the list.' }
      ),

      summary: v.object(
        {
          cost: agentTrackingSpendCostSchema,
          requests: count('requests', 'Model requests in the range.'),
          sessions: count('sessions', 'Sessions with usage in the range.'),
          active_members: count('active_members', 'Members with usage in the range.'),
          counts_capped: v.boolean({
            name: 'counts_capped',
            description: `Whether a distinct count reached its limit of ${maxDistinctCount.toLocaleString('en-US')}: \`sessions\` and \`active_members\` here, or \`sessions\` of a member. Those counts then show the limit, not the real number.`
          }),
          unattributed_cost_micros: agentTrackingNullableMicrosSchema(
            'unattributed_cost_micros',
            'The part of `cost.total_micros` from usage without a member. It counts in every share but belongs to no item. `null` when no cost is known.'
          ),
          members: count(
            'members',
            'Members ranked, before `flagged_only` filters them. Fewer than all when `truncated`.'
          ),
          flag_counts: v.object(
            {
              model_share: flagCount('model_share'),
              high_effort: flagCount('high_effort'),
              fast_mode: flagCount('fast_mode'),
              outdated_models: flagCount('outdated_models'),
              low_cache_hit_rate: flagCount('low_cache_hit_rate'),
              low_usage_seat: flagCount('low_usage_seat')
            },
            {
              name: 'flag_counts',
              description:
                'Members per flag among the members ranked, before `flagged_only` filters them.'
            }
          ),
          models: modelUsageSchema(
            'The usage of the models in `model_id` across the instance, including usage without a member. `null` unless `include` has `models`.'
          ),
          practices: v.nullable(
            v.object(practiceProperties, {
              name: 'practices',
              description:
                'The practice figures across the instance, including usage without a member. `null` unless `include` has `practices`.'
            })
          ),
          seat: v.nullable(
            v.object(
              {
                unknown_seat_members: count(
                  'unknown_seat_members',
                  'Members ranked whose requests reported no seat type.'
                )
              },
              { name: 'seat', description: 'Seat counts. `null` unless `include` has `seat`.' }
            )
          ),
          request_records_clipped: v.boolean({
            name: 'request_records_clipped',
            description: `Whether the range starts more than ${requestRecordDays} days ago, so \`practices\` and \`seat\` cover only its most recent ${requestRecordDays} days.`
          })
        },
        {
          name: 'summary',
          description:
            'The whole instance over the same range. Totals cover all usage of the instance, whether or not the list is `truncated`.'
        }
      )
    })
  )
  .build();
