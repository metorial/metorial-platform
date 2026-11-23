import { ServiceError, validationError } from '@lowerdeck/error';
import { v, type ValidationError, type ValidationTypeValue } from '@lowerdeck/validation';
import { filterValueList } from './filterValues';
import { memberInsightsSorts } from './memberInsights';
import { maxInsightMembers, memberWindowDays } from './queries';
import { rangePresets } from './range';

export let maxViewNameLength = 80;

export let maxViewNameInputLength = 200;

export let maxViewsPerPage = 50;

export let agentTrackingViewEntity = 'agent_tracking.view';

export let agentTrackingViewPages = ['team'] as const;

export let teamViewKinds = [
  'recent',
  'leaderboard',
  'by_model',
  'practices',
  'seats'
] as const;

export type AgentTrackingViewPage = (typeof agentTrackingViewPages)[number];

export type TeamViewKind = (typeof teamViewKinds)[number];

let nameNotAllowed = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

let share = (name: string, description: string) =>
  v.optional(
    v.number({
      name,
      description: `${description} From 0 to 1.`,
      examples: [0.5],
      modifiers: [v.minValue(0), v.maxValue(1)]
    })
  );

export let memberInsightsParamFields = {
  sort: v.optional(
    v.enumOf(memberInsightsSorts, {
      name: 'sort',
      description:
        'The figure to rank members by. Defaults to `cost`. `model_share` and `model_cost` need the `models` column group; `high_effort_share`, `fast_share`, `outdated_share` and `cache_hit_rate` need `practices`; `seat_usage` (usage at list prices) needs `seat`. `order` sets the direction, highest first by default.'
    })
  ),
  include_inactive: v.optional(
    v.boolean({
      name: 'include_inactive',
      description: `Also list members without usage in the range, with zero figures: those with a session in this instance in the last ${memberWindowDays} days and the consumers of this instance (not service accounts or pending ones). They only fill the room members with usage leave below ${maxInsightMembers}. Defaults to \`false\`.`,
      examples: [true]
    })
  ),
  flagged_only: v.optional(
    v.boolean({
      name: 'flagged_only',
      description:
        'Only return members with at least one flag. `rank` and the summary still cover every member. Defaults to `false`.',
      examples: [true]
    })
  ),
  model_share_min: share(
    'model_share_min',
    'Flag `model_share` for members with at least this share of their cost on the selected models. Needs the `models` column group.'
  ),
  high_effort_share_min: share(
    'high_effort_share_min',
    'Flag `high_effort` for members with at least this share of requests at `high` or `max` reasoning effort. Needs the `practices` column group.'
  ),
  fast_share_min: share(
    'fast_share_min',
    'Flag `fast_mode` for members with at least this share of requests in the fast speed tier. Needs the `practices` column group.'
  ),
  outdated_share_min: share(
    'outdated_share_min',
    'Flag `outdated_models` for members with at least this share of their cost on `deprecated` or `retired` models. Needs the `practices` column group.'
  ),
  cache_hit_rate_max: share(
    'cache_hit_rate_max',
    'Flag `low_cache_hit_rate` for members whose prompt cache hit rate is below this. Needs the `practices` column group.'
  ),
  seat_usage_max_micros: v.optional(
    v.number({
      name: 'seat_usage_max_micros',
      description:
        'Flag `low_usage_seat` for members whose usage at list prices is below this, in micro-dollars. Members without usage count as `0`. Needs the `seat` column group.',
      examples: [20000000],
      modifiers: [v.integer(), v.minValue(0)]
    })
  )
};

export let teamViewParamsValidator = v.object(
  {
    version: v.literal(1, {
      name: 'version',
      description: 'Version of the parameter format. Always `1`.'
    }),
    range: v.optional(
      v.enumOf(rangePresets, {
        name: 'range',
        description:
          'Calendar range the view covers, resolved when the view is opened. Views store presets only, never dates.'
      })
    ),
    order: v.optional(
      v.enumOf(['asc', 'desc'], {
        name: 'order',
        description: 'Ranking direction. `desc` puts the highest first.'
      })
    ),
    model_ids: v.optional(
      filterValueList({
        name: 'model_ids',
        description:
          'Models whose usage the view measures. A `by_model` view needs at least one.',
        examples: [['claude-sonnet-4-5']]
      })
    ),
    seats: v.optional(
      filterValueList({
        name: 'seats',
        description: 'Seat types the `low_usage_seat` flag considers.',
        examples: [['premium']]
      })
    ),
    ...memberInsightsParamFields
  },
  {
    name: 'params',
    description:
      'Settings the view opens the page with. Never contains members. Fields left out use the page defaults.'
  }
);

export type TeamViewParams = ValidationTypeValue<typeof teamViewParamsValidator>;

let invalidView = (errors: ValidationError[]) =>
  new ServiceError(validationError({ entity: agentTrackingViewEntity, errors }));

// Lower, upper, lower folds case beyond toLowerCase (ß, final sigma); NFKC again recomposes.
export let viewNameKey = (name: string) =>
  name.normalize('NFKC').toLowerCase().toUpperCase().toLowerCase().normalize('NFKC');

export let parseViewName = (name: string) => {
  if (nameNotAllowed.test(name)) {
    throw invalidView([
      {
        code: 'invalid_string',
        message:
          'The name cannot contain control, formatting or line separator characters, including zero-width characters.',
        path: ['name']
      }
    ]);
  }

  let normalized = name.trim().replace(/\s+/g, ' ');

  if (!normalized.length || normalized.length > maxViewNameLength) {
    throw invalidView([
      {
        code: 'invalid_length',
        message: `The name must have 1 to ${maxViewNameLength} characters.`,
        path: ['name']
      }
    ]);
  }

  return { name: normalized, nameKey: viewNameKey(normalized) };
};

export let assertViewParams = (kind: TeamViewKind, params: { model_ids?: string[] }) => {
  if (kind == 'by_model' && !params.model_ids?.length) {
    throw invalidView([
      {
        code: 'required',
        message: 'A by_model view needs at least one model in model_ids.',
        path: ['params', 'model_ids']
      }
    ]);
  }
};
