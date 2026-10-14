import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxImageBuildsLogsOutput = {
  object: 'sandbox.log_lines';
  lines: {
    index: number;
    source: 'system' | 'stdout' | 'stderr';
    timestamp: Date;
    text: string;
  }[];
  nextCursor: number | null;
  hasMore: boolean;
  lineCount: number;
  status: 'open' | 'sealed';
  truncated: boolean;
};

export let mapManagementInstanceSandboxImageBuildsLogsOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxImageBuildsLogsOutput>([
    ['lines', 0, [2, [1, [['timestamp', 0, 4]]]]],
    'next_cursor',
    'has_more',
    'line_count'
  ]);

export type ManagementInstanceSandboxImageBuildsLogsQuery = {
  direction?: 'forward' | 'backward' | undefined;
  cursor?: number | undefined;
  limit?: number | undefined;
};

export let mapManagementInstanceSandboxImageBuildsLogsQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxImageBuildsLogsQuery>(
    0
  );
