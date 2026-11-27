import { v } from '@lowerdeck/validation';
import {
  growthRateBounds,
  maxDistinctCount,
  reportBreakdownLimits,
  type AgentTrackingProjectionScenario,
  type AgentTrackingSpendBreakdownItem
} from '@metorial/module-agent-tracking-query';
import { Presenter } from '@metorial/presenter';
import {
  agentTrackingSpendBreakdownType,
  agentTrackingSpendReportType,
  agentTrackingSpendTimelineType
} from '../../types';
import {
  agentTrackingClientSchema,
  agentTrackingMemberSchema,
  agentTrackingMicrosSchema,
  agentTrackingModelSchema,
  agentTrackingNullableMicrosSchema,
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

let presentBreakdownItem = (
  item: AgentTrackingSpendBreakdownItem,
  d: { client: boolean }
) => ({
  kind: item.kind,
  key: item.key,
  member: item.member ? presentAgentTrackingMember(item.member) : null,
  model: item.model ? { id: item.model.id, name: item.model.name } : null,
  ...(d.client
    ? {
        client: item.client ? { family: item.client.family, name: item.client.name } : null
      }
    : {}),
  unknown_model_names: item.unknownModelNames,
  share: item.share,
  ...presentFigures(item)
});

let breakdownItemSchema = <
  const Kinds extends readonly ('member' | 'model' | 'client' | 'unknown' | 'other')[]
>(d: {
  kinds: Kinds;
  kind: string;
  key: string;
  examples: string[];
  client: boolean;
  unknownModelNames: string;
}) =>
  v.object({
    kind: v.enumOf(d.kinds, { name: 'kind', description: d.kind }),
    key: v.string({ name: 'key', description: d.key, examples: d.examples }),
    member: v.nullable(agentTrackingMemberSchema),
    model: v.nullable(agentTrackingModelSchema),
    ...(d.client ? { client: v.nullable(agentTrackingClientSchema) } : {}),
    unknown_model_names: agentTrackingUnknownModelNamesSchema(d.unknownModelNames),
    share: v.nullable(
      v.number({
        name: 'share',
        description:
          'The share of the total cost, from 0 to 1. `null` when the total cost is zero or unknown.'
      })
    ),
    ...agentTrackingSpendFiguresProperties
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

    items: breakdown.items.map(item => presentBreakdownItem(item, { client: false }))
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
        breakdownItemSchema({
          kinds: ['member', 'model', 'unknown', 'other'],
          kind: '`member` or `model` for a group; `unknown` for usage without a member (Unknown Member) or whose model is not matched to the model catalog (Unknown Model, see `unknown_model_names`); `other` for everything past the top 10, added up.',
          key: 'The member or model id, `unknown`, or `other`. Unique within the breakdown.',
          examples: ['aten_0mhNnEqM7XQb3vXq8gD2', 'unknown', 'other'],
          client: false,
          unknownModelNames:
            'On the `unknown` item of a breakdown by model: the models that make it up, most requests first, at most 10. Empty on every other item and in a breakdown by member.'
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

let presentReportItems = (items: AgentTrackingSpendBreakdownItem[] | null) =>
  items?.map(item => presentBreakdownItem(item, { client: true })) ?? null;

let presentScenario = (scenario: AgentTrackingProjectionScenario) => ({
  growth_rate: scenario.growthRate,
  year_end_total_micros: scenario.yearEndTotalMicros,
  next_year_total_micros: scenario.nextYearTotalMicros,
  months: scenario.months.map(month => ({
    month: month.month,
    actual_micros: month.actualMicros,
    projected_micros: month.projectedMicros,
    total_micros: month.totalMicros
  }))
});

let monthKey = (description: string) =>
  v.string({
    name: 'month',
    description: `${description} As YYYY-MM.`,
    examples: ['2026-11']
  });

let reportItemsSchema = (group: 'model' | 'client' | 'member', description: string) =>
  v.nullable(
    v.array(
      breakdownItemSchema({
        kinds: ['member', 'model', 'client', 'unknown', 'other'],
        kind: `\`${group}\` for a group; \`unknown\` for usage without a ${group == 'model' ? 'model matched to the model catalog (Unknown Model, see `unknown_model_names`)' : group == 'client' ? 'client family' : 'member (Unknown Member)'}; \`other\` for everything past the top ${reportBreakdownLimits[group].toLocaleString('en-US')}, added up.`,
        key: `The ${group == 'client' ? 'client family' : `${group} id`}, \`unknown\`, or \`other\`. Unique within the list.`,
        examples: [
          group == 'member'
            ? 'aten_0mhNnEqM7XQb3vXq8gD2'
            : group == 'model'
              ? 'claude-sonnet-4-5'
              : 'claude_code'
        ],
        client: true,
        unknownModelNames:
          'On the `unknown` item of the model list: the models that make it up, most requests first, at most 10. Empty on every other item.'
      }),
      { name: group, description }
    )
  );

let scenarioSchema = (name: 'flat' | 'growth', description: string) =>
  v.object(
    {
      growth_rate: v.number({
        name: 'growth_rate',
        description:
          'The monthly growth this scenario applies, as a fraction: `0.05` is 5% more each month. Always `0` for `flat`.',
        examples: [0.05]
      }),
      year_end_total_micros: agentTrackingMicrosSchema(
        'year_end_total_micros',
        "The projected cost of the whole report year: `total.cost.total_micros` so far (`0` when `null`) plus every `projected_micros` of the year's months."
      ),
      next_year_total_micros: agentTrackingMicrosSchema(
        'next_year_total_micros',
        'The projected cost of the year after: the sum of `total_micros` over its months.'
      ),
      months: v.array(
        v.object({
          month: monthKey('The calendar month.'),
          actual_micros: agentTrackingMicrosSchema(
            'actual_micros',
            'The cost already recorded. Only the current month has one; `0` for later months.'
          ),
          projected_micros: agentTrackingMicrosSchema(
            'projected_micros',
            'The projected cost of the month after `range.to`: the rest of the current month, or all of a later month.'
          ),
          total_micros: agentTrackingMicrosSchema(
            'total_micros',
            '`actual_micros` plus `projected_micros`.'
          )
        }),
        {
          name: 'months',
          description:
            'One item per month from the current month to December of the year after, oldest first.'
        }
      )
    },
    { name, description }
  );

export let v1AgentTrackingSpendReportPresenter = Presenter.create(agentTrackingSpendReportType)
  .presenter(async ({ report }) => ({
    object: 'agent_tracking.spend_report' as const,

    year: report.year,
    range: presentAgentTrackingRange(report.range),
    total: presentFigures(report.total),
    counts: report.counts
      ? {
          sessions: report.counts.sessions,
          members: report.counts.members,
          capped: report.counts.capped
        }
      : null,
    starts_before_retention: report.startsBeforeRetention,
    privacy: presentPrivacy(report.privacy),
    coverage: {
      first_day: report.coverage.firstDay,
      days_with_data: report.coverage.daysWithData,
      hidden_days: report.coverage.hiddenDays,
      starts_before_year: report.coverage.startsBeforeYear,
      last_full_day: report.coverage.lastFullDay
    },

    months: report.months.map(month => ({
      month: month.month,
      starts_at: month.startsAt,
      hidden_days: month.hiddenDays,
      ...presentFigures(month),
      counts: month.counts
        ? { sessions: month.counts.sessions, members: month.counts.members }
        : null
    })),

    breakdowns: {
      model: presentReportItems(report.breakdowns.model),
      client: presentReportItems(report.breakdowns.client),
      member: presentReportItems(report.breakdowns.member)
    },

    projection: {
      status: report.projection.status,
      baseline: report.projection.baseline
        ? {
            from: report.projection.baseline.from,
            to: report.projection.baseline.to,
            days: report.projection.baseline.days,
            daily_rate_micros: report.projection.baseline.dailyRateMicros
          }
        : null,
      growth: report.projection.growth
        ? { rate: report.projection.growth.rate, source: report.projection.growth.source }
        : null,
      scenarios: report.projection.scenarios
        ? {
            flat: presentScenario(report.projection.scenarios.flat),
            growth: presentScenario(report.projection.scenarios.growth)
          }
        : null
    }
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.spend_report', {
        description: 'String representing the object’s type.'
      }),

      year: v.number({
        name: 'year',
        description: 'The calendar year the report covers.',
        examples: [2026]
      }),
      range: agentTrackingRangeSchema,
      total: v.object(agentTrackingSpendFiguresProperties, {
        name: 'total',
        description:
          'The figures for the year so far. When the organization hides individual data, the sum over the shown days only.'
      }),
      counts: v.nullable(
        v.object(
          {
            sessions: v.number({
              name: 'sessions',
              description:
                'Sessions with usage in the range, including sessions that started before it. Usage is any model request, token or nonzero cost.'
            }),
            members: v.number({
              name: 'members',
              description:
                'Distinct members with usage in the range. Usage without a member (Unknown Member) is not counted.'
            }),
            capped: v.boolean({
              name: 'capped',
              description: `Whether a count reached ${maxDistinctCount.toLocaleString('en-US')}, where counting stops. The count is then at least the number shown.`
            })
          },
          {
            name: 'counts',
            description:
              'How many sessions and members the year so far covers. `null` when the organization hides individual data and a day of the range is hidden.'
          }
        )
      ),
      starts_before_retention: v.boolean({
        name: 'starts_before_retention',
        description:
          'Whether the year starts before the 400 days usage is kept, so its figures cover less than the whole year.'
      }),
      privacy: v.object(
        {
          hide_individuals: v.boolean({
            name: 'hide_individuals',
            description:
              'Whether the organization hides individual data. The report then counts whole days in UTC up to yesterday, hides days below `min_group_users` and leaves out every breakdown.'
          }),
          min_group_users: v.number({
            name: 'min_group_users',
            description:
              'With `hide_individuals`, the fewest people a group must have to be shown.',
            examples: [5]
          }),
          hidden_groups: v.boolean({
            name: 'hidden_groups',
            description:
              'Whether some days of the year are hidden because fewer people than `min_group_users` had usage on them.'
          })
        },
        {
          name: 'privacy',
          description: 'The privacy settings the figures were computed under.'
        }
      ),
      coverage: v.object(
        {
          first_day: v.nullable(
            v.string({
              name: 'first_day',
              description:
                'The first day of the year with usage, as YYYY-MM-DD in `range.time_zone`. `null` when the year has none yet. Hidden days count as days with usage.',
              examples: ['2026-03-02']
            })
          ),
          days_with_data: v.number({
            name: 'days_with_data',
            description:
              'Days of the year with usage, including hidden days and, unless the organization hides individual data, today. Usage is any model request, token or nonzero cost.'
          }),
          hidden_days: v.number({
            name: 'hidden_days',
            description:
              'Days of the year hidden because fewer people than `privacy.min_group_users` had usage on them. Always `0` unless the organization hides individual data.'
          }),
          starts_before_year: v.boolean({
            name: 'starts_before_year',
            description:
              'Whether usage started before the year rather than on `first_day`: there was usage in the December before it.'
          }),
          last_full_day: v.nullable(
            v.string({
              name: 'last_full_day',
              description:
                'The last complete day the report includes, as YYYY-MM-DD: yesterday for the current year, December 31 for last year. `null` on January 1 of the current year.',
              examples: ['2026-11-21']
            })
          )
        },
        {
          name: 'coverage',
          description:
            'How far the usage of the year reaches, to say from when the figures hold.'
        }
      ),

      months: v.array(
        v.object({
          month: monthKey('The calendar month in `range.time_zone`.'),
          starts_at: v.date({
            name: 'starts_at',
            description: 'When the month starts in `range.time_zone`.'
          }),
          hidden_days: v.number({
            name: 'hidden_days',
            description:
              'Days of the month hidden because fewer people than `privacy.min_group_users` had usage on them; the figures leave them out. Always `0` unless the organization hides individual data.'
          }),
          ...agentTrackingSpendFiguresProperties,
          counts: v.nullable(
            v.object(
              {
                sessions: v.number({
                  name: 'sessions',
                  description:
                    'Sessions with usage in the month, counted like `counts.sessions`. A session with usage in several months counts in each.'
                }),
                members: v.number({
                  name: 'members',
                  description:
                    'Distinct members with usage in the month, counted like `counts.members`. A member with usage in several months counts in each.'
                })
              },
              {
                name: 'counts',
                description:
                  'How many sessions and members were active in the month. `null` when the organization hides individual data and the month has a hidden day, has no complete day yet, or is withheld because fewer people than `privacy.min_group_users` had usage in it.'
              }
            )
          )
        }),
        {
          name: 'months',
          description:
            'One item per calendar month from January to the current month (to December for last year), oldest first, including months without usage (zero). The current month ends where `range.to` ends.'
        }
      ),

      breakdowns: v.object(
        {
          model: reportItemsSchema(
            'model',
            `The year so far by model: the top ${reportBreakdownLimits.model} by cost, then everything else as one \`other\` item. \`null\` when the organization hides individual data.`
          ),
          client: reportItemsSchema(
            'client',
            'The year so far by AI coding agent, ranked like `model`. `null` when the organization hides individual data.'
          ),
          member: reportItemsSchema(
            'member',
            `The year so far by member: the top ${reportBreakdownLimits.member.toLocaleString('en-US')} by cost, then everything else as one \`other\` item. \`null\` when the organization hides individual data.`
          )
        },
        {
          name: 'breakdowns',
          description:
            'The cost of the year so far split three ways, most expensive first (ties ordered by key). Groups without requests, tokens or cost are left out. Each list adds up to `total`.'
        }
      ),

      projection: v.object(
        {
          status: v.enumOf(['projected', 'insufficient_data', 'not_applicable'], {
            name: 'status',
            description:
              '`projected` when the figures below are set; `insufficient_data` when there is no complete day after the first day with usage yet or the baseline has fewer than 7 days (hidden days do not count, days without a known cost count as 0); `not_applicable` for a past year.'
          }),
          baseline: v.nullable(
            v.object(
              {
                from: v.string({
                  name: 'from',
                  description:
                    'The first day averaged, as YYYY-MM-DD: 30 days before today, or the day after usage started when that is later, since the first day with usage is only partly recorded. It can fall in the year before.',
                  examples: ['2026-10-23']
                }),
                to: v.string({
                  name: 'to',
                  description: 'The last day averaged, inclusive: yesterday.',
                  examples: ['2026-11-21']
                }),
                days: v.number({
                  name: 'days',
                  description:
                    'How many days were averaged. Hidden days are left out of the average rather than counted as zero; days without a known cost count as 0.'
                }),
                daily_rate_micros: agentTrackingNullableMicrosSchema(
                  'daily_rate_micros',
                  'The average cost per day over the baseline, never below 0. `null` unless `status` is `projected`.'
                )
              },
              {
                name: 'baseline',
                description:
                  'The days the projection starts from. `null` when there is no complete day after the first day with usage yet or the report is for a past year.'
              }
            )
          ),
          growth: v.nullable(
            v.object(
              {
                rate: v.number({
                  name: 'rate',
                  description: `The monthly growth of the \`growth\` scenario, as a fraction: from ${growthRateBounds.input.min} to ${growthRateBounds.input.max} when passed, from ${growthRateBounds.observed.min} to ${growthRateBounds.observed.max} when observed.`,
                  examples: [0.05]
                }),
                source: v.enumOf(['input', 'observed', 'default'], {
                  name: 'source',
                  description:
                    '`input` when `growth_rate` was passed; `observed` for the geometric mean change in cost per day between consecutive complete months of usage this year, when at least 2 such changes can be compared; `default` (`0`) otherwise. Months without a positive cost or with hidden days are not compared.'
                })
              },
              {
                name: 'growth',
                description:
                  'The growth the `growth` scenario applies. `null` unless `status` is `projected`.'
              }
            )
          ),
          scenarios: v.nullable(
            v.object(
              {
                flat: scenarioSchema(
                  'flat',
                  'Every coming day costs the baseline daily rate.'
                ),
                growth: scenarioSchema(
                  'growth',
                  'The cost per day of each month after the current one is `growth.rate` more than in the month before, compounding; a month costs its cost per day times its days.'
                )
              },
              {
                name: 'scenarios',
                description:
                  'The projected cost per month and per year. `null` unless `status` is `projected`.'
              }
            )
          )
        },
        {
          name: 'projection',
          description:
            'A projection of `cost.total_micros`, the figure the totals show, from the average cost per day through the end of next year. Only for the current year.'
        }
      )
    })
  )
  .build();
