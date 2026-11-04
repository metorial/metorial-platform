import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsMcpAvailabilityGetOutput = {
  object: 'skill.mcp_availability';
  skillId: string;
  available: boolean;
  exceededLimits: ('file_count' | 'size')[];
  fileCount: number;
  size: number;
  maxFileCount: number;
  maxSize: number;
};

export let mapDashboardInstanceSkillsMcpAvailabilityGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsMcpAvailabilityGetOutput>([
    'skill_id',
    'exceeded_limits',
    'file_count',
    'max_file_count',
    'max_size'
  ]);
