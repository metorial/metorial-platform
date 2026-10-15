import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxMachinesInstancesLogsOutput = {
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

export let mapDashboardInstanceSandboxMachinesInstancesLogsOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxMachinesInstancesLogsOutput>(
    [
      ['lines', 0, [2, [1, [['timestamp', 0, 4]]]]],
      'next_cursor',
      'has_more',
      'line_count'
    ]
  );

export type DashboardInstanceSandboxMachinesInstancesLogsQuery = {
  direction?: 'forward' | 'backward' | undefined;
  cursor?: number | undefined;
  limit?: number | undefined;
};

export let mapDashboardInstanceSandboxMachinesInstancesLogsQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxMachinesInstancesLogsQuery>(
    0
  );
