import type {
  DashboardInstanceAgentTrackingMembersInsightsOutput,
  DashboardInstanceAgentTrackingMembersInsightsQuery
} from '@metorial/dashboard-sdk';
import { defaultAgentTrackingRange, type AgentTrackingRangePreset } from '../range';

export let maxSavedViews = 50;

export let maxInsightMembers = 2000;

export let maxSeatUsageDollars = 1_000_000;

export let teamViewKinds = [
  'recent',
  'leaderboard',
  'by_model',
  'practices',
  'seats'
] as const;

export type TeamViewKind = (typeof teamViewKinds)[number];

export type InsightsGroup = 'models' | 'practices' | 'seat';

export type InsightsSort = NonNullable<
  DashboardInstanceAgentTrackingMembersInsightsQuery['sort']
>;

export type SortOrder = 'asc' | 'desc';

export type InsightFlag =
  DashboardInstanceAgentTrackingMembersInsightsOutput['items'][number]['flags'][number];

export type TeamViewParams = {
  range?: AgentTrackingRangePreset;
  sort?: InsightsSort;
  order?: SortOrder;
  includeInactive?: boolean;
  modelIds?: string[];
  seats?: string[];
  modelShareMin?: number;
  highEffortShareMin?: number;
  fastShareMin?: number;
  outdatedShareMin?: number;
  cacheHitRateMax?: number;
  seatUsageMaxMicros?: number;
  flaggedOnly?: boolean;
};

export type TeamViewField = keyof TeamViewParams;

export type TeamViewState = { kind: TeamViewKind; params: TeamViewParams };

export type TeamViewColumn =
  | 'rank'
  | 'member'
  | 'cost'
  | 'share'
  | 'sessions'
  | 'requests'
  | 'lastActive'
  | 'modelCost'
  | 'modelShare'
  | 'modelRequests'
  | 'highEffort'
  | 'fastMode'
  | 'outdated'
  | 'cacheHitRate'
  | 'seat'
  | 'plan'
  | 'seatUsage';

export type TeamViewDefinition = {
  kind: TeamViewKind;
  label: string;
  description: string;
  include: InsightsGroup[];
  fields: TeamViewField[];
  defaults: TeamViewParams;
  sorts: { id: InsightsSort; column: TeamViewColumn; order?: SortOrder }[];
  columns: { id: TeamViewColumn; header: string; title?: string; flag?: InsightFlag }[];
};

export let defaultTeamViewKind: TeamViewKind = 'recent';

export let teamViewDefinitions: Record<TeamViewKind, TeamViewDefinition> = {
  recent: {
    kind: 'recent',
    label: 'Recent Activity',
    description: 'Everyone who sent usage, most recently active first.',
    include: [],
    fields: ['range'],
    defaults: {},
    sorts: [],
    columns: []
  },
  leaderboard: {
    kind: 'leaderboard',
    label: 'Leaderboard',
    description: 'Members ranked by cost, sessions or requests in the range.',
    include: [],
    fields: ['range', 'sort', 'order', 'includeInactive'],
    defaults: {
      range: defaultAgentTrackingRange,
      sort: 'cost',
      order: 'desc',
      includeInactive: false
    },
    sorts: [
      { id: 'cost', column: 'cost' },
      { id: 'sessions', column: 'sessions' },
      { id: 'requests', column: 'requests' }
    ],
    columns: [
      { id: 'rank', header: 'Rank' },
      { id: 'member', header: 'Member' },
      { id: 'cost', header: 'Cost' },
      { id: 'share', header: 'Share' },
      { id: 'sessions', header: 'Sessions', title: 'Sessions With Usage' },
      { id: 'requests', header: 'Requests' },
      { id: 'lastActive', header: 'Last Active' }
    ]
  },
  by_model: {
    kind: 'by_model',
    label: 'By Model',
    description: 'Who uses the models you choose, and how much of their cost goes to them.',
    include: ['models'],
    fields: ['range', 'sort', 'order', 'modelIds', 'modelShareMin', 'flaggedOnly'],
    defaults: {
      range: defaultAgentTrackingRange,
      sort: 'model_cost',
      order: 'desc',
      modelIds: [],
      modelShareMin: 0.5,
      flaggedOnly: false
    },
    sorts: [
      { id: 'model_cost', column: 'modelCost' },
      { id: 'model_share', column: 'modelShare' },
      { id: 'cost', column: 'cost' }
    ],
    columns: [
      { id: 'rank', header: 'Rank' },
      { id: 'member', header: 'Member' },
      { id: 'modelCost', header: 'Model Cost', title: 'Cost on Selected Models' },
      {
        id: 'modelShare',
        header: 'Share of Cost',
        title: "Share of Member's Cost",
        flag: 'model_share'
      },
      { id: 'modelRequests', header: 'Model Requests', title: 'Requests on Selected Models' },
      { id: 'cost', header: 'Total Cost' }
    ]
  },
  practices: {
    kind: 'practices',
    label: 'Practices',
    description:
      'Reasoning effort, fast mode, outdated models and prompt caching for each member.',
    include: ['practices'],
    fields: [
      'range',
      'sort',
      'order',
      'highEffortShareMin',
      'fastShareMin',
      'outdatedShareMin',
      'cacheHitRateMax',
      'flaggedOnly'
    ],
    defaults: {
      range: defaultAgentTrackingRange,
      sort: 'cost',
      order: 'desc',
      highEffortShareMin: 0.8,
      fastShareMin: 0.25,
      outdatedShareMin: 0.25,
      cacheHitRateMax: 0.5,
      flaggedOnly: false
    },
    sorts: [
      { id: 'cost', column: 'cost' },
      { id: 'high_effort_share', column: 'highEffort' },
      { id: 'fast_share', column: 'fastMode' },
      { id: 'outdated_share', column: 'outdated' },
      { id: 'cache_hit_rate', column: 'cacheHitRate', order: 'asc' }
    ],
    columns: [
      { id: 'member', header: 'Member' },
      { id: 'highEffort', header: 'High Effort', flag: 'high_effort' },
      { id: 'fastMode', header: 'Fast Mode', flag: 'fast_mode' },
      { id: 'outdated', header: 'Outdated Models', flag: 'outdated_models' },
      { id: 'cacheHitRate', header: 'Cache Hit Rate', flag: 'low_cache_hit_rate' },
      { id: 'cost', header: 'Cost' }
    ]
  },
  seats: {
    kind: 'seats',
    label: 'Low-Usage Seats',
    description:
      'Members whose usage at list prices is low for the range, to review seat assignments.',
    include: ['seat'],
    fields: [
      'range',
      'sort',
      'order',
      'includeInactive',
      'seats',
      'seatUsageMaxMicros',
      'flaggedOnly'
    ],
    defaults: {
      range: defaultAgentTrackingRange,
      sort: 'seat_usage',
      order: 'asc',
      includeInactive: true,
      seats: [],
      seatUsageMaxMicros: 50_000_000,
      flaggedOnly: false
    },
    sorts: [
      { id: 'seat_usage', column: 'seatUsage' },
      { id: 'cost', column: 'cost' },
      { id: 'last_activity', column: 'lastActive', order: 'asc' }
    ],
    columns: [
      { id: 'member', header: 'Member' },
      { id: 'seat', header: 'Seat' },
      { id: 'plan', header: 'Plan' },
      { id: 'seatUsage', header: 'Usage at List Price', flag: 'low_usage_seat' },
      { id: 'cost', header: 'Cost' },
      { id: 'lastActive', header: 'Last Active' }
    ]
  }
};

export let isTeamViewKind = (value: unknown): value is TeamViewKind =>
  typeof value == 'string' && (teamViewKinds as readonly string[]).includes(value);
