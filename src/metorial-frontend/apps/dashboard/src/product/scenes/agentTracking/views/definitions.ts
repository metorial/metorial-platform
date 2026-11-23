import type { DashboardInstanceAgentTrackingMembersInsightsQuery } from '@metorial/dashboard-sdk';
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
  | 'seatUsage'
  | 'flags';

export type TeamViewDefinition = {
  kind: TeamViewKind;
  label: string;
  description: string;
  include: InsightsGroup[];
  fields: TeamViewField[];
  defaults: TeamViewParams;
  sorts: { id: InsightsSort; label: string }[];
  columns: { id: TeamViewColumn; header: string }[];
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
      { id: 'cost', label: 'Cost' },
      { id: 'sessions', label: 'Sessions With Usage' },
      { id: 'requests', label: 'Requests' }
    ],
    columns: [
      { id: 'rank', header: 'Rank' },
      { id: 'member', header: 'Member' },
      { id: 'cost', header: 'Cost' },
      { id: 'share', header: 'Share' },
      { id: 'sessions', header: 'Sessions With Usage' },
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
      { id: 'model_cost', label: 'Cost on Selected Models' },
      { id: 'model_share', label: "Share of Member's Cost" },
      { id: 'cost', label: 'Total Cost' }
    ],
    columns: [
      { id: 'rank', header: 'Rank' },
      { id: 'member', header: 'Member' },
      { id: 'modelCost', header: 'Cost on Selected Models' },
      { id: 'modelShare', header: "Share of Member's Cost" },
      { id: 'modelRequests', header: 'Requests on Selected Models' },
      { id: 'cost', header: 'Total Cost' },
      { id: 'flags', header: 'Flags' }
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
      { id: 'cost', label: 'Cost' },
      { id: 'high_effort_share', label: 'High Effort' },
      { id: 'fast_share', label: 'Fast Mode' },
      { id: 'outdated_share', label: 'Outdated Models' },
      { id: 'cache_hit_rate', label: 'Cache Hit Rate' }
    ],
    columns: [
      { id: 'member', header: 'Member' },
      { id: 'highEffort', header: 'High Effort' },
      { id: 'fastMode', header: 'Fast Mode' },
      { id: 'outdated', header: 'Outdated Models' },
      { id: 'cacheHitRate', header: 'Cache Hit Rate' },
      { id: 'cost', header: 'Cost' },
      { id: 'flags', header: 'Flags' }
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
      { id: 'seat_usage', label: 'Usage at List Price' },
      { id: 'cost', label: 'Cost' },
      { id: 'last_activity', label: 'Last Active' }
    ],
    columns: [
      { id: 'member', header: 'Member' },
      { id: 'seat', header: 'Seat' },
      { id: 'plan', header: 'Plan' },
      { id: 'seatUsage', header: 'Usage at List Price' },
      { id: 'cost', header: 'Cost' },
      { id: 'lastActive', header: 'Last Active' },
      { id: 'flags', header: 'Flags' }
    ]
  }
};

export let isTeamViewKind = (value: unknown): value is TeamViewKind =>
  typeof value == 'string' && (teamViewKinds as readonly string[]).includes(value);
