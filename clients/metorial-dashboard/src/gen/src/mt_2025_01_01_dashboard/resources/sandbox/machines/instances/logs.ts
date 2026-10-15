import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type SandboxMachinesInstancesLogsOutput = {
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

export let mapSandboxMachinesInstancesLogsOutput =
  /* @__PURE__ */ mapObject<SandboxMachinesInstancesLogsOutput>([
    ['lines', 0, [2, [1, [['timestamp', 0, 4]]]]],
    'next_cursor',
    'has_more',
    'line_count'
  ]);

export type SandboxMachinesInstancesLogsQuery = {
  direction?: 'forward' | 'backward' | undefined;
  cursor?: number | undefined;
  limit?: number | undefined;
};

export let mapSandboxMachinesInstancesLogsQuery =
  /* @__PURE__ */ createMapper<SandboxMachinesInstancesLogsQuery>(0);
