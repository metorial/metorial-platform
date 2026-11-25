import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingToolsSkillsOutput = {
  object: 'agent_tracking.skill_usage';
  range: { preset: string | null; from: Date; to: Date; timeZone: string };
  toolDetails: boolean;
  summary: {
    activations: number;
    namedActivations: number;
    members: number;
    countsCapped: boolean;
  };
  items: {
    name: string;
    activations: number;
    members: number;
    lastUsedAt: Date | null;
  }[];
  truncated: boolean;
};

export let mapDashboardInstanceAgentTrackingToolsSkillsOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingToolsSkillsOutput>(
    [
      ['range', 0, [1, [['from', 0, 4], ['to', 0, 4], 'time_zone']]],
      'tool_details',
      ['summary', 0, [1, ['named_activations', 'counts_capped']]],
      ['items', 0, [2, [1, ['last_used_at']]]]
    ],
    1
  );

export type DashboardInstanceAgentTrackingToolsSkillsQuery = {
  range?:
    'today' | 'last_7_days' | 'last_30_days' | 'month_to_date' | 'last_month' | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  timeZone?: string | undefined;
};

export let mapDashboardInstanceAgentTrackingToolsSkillsQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingToolsSkillsQuery>([
    ['from', 0, 4],
    ['to', 0, 4],
    'time_zone'
  ]);
