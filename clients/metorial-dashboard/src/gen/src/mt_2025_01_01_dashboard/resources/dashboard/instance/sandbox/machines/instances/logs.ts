import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<DashboardInstanceSandboxMachinesInstancesLogsOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    lines: mtMap.objectField(
      'lines',
      mtMap.array(
        mtMap.object({
          index: mtMap.objectField('index', mtMap.passthrough()),
          source: mtMap.objectField('source', mtMap.passthrough()),
          timestamp: mtMap.objectField('timestamp', mtMap.date()),
          text: mtMap.objectField('text', mtMap.passthrough())
        })
      )
    ),
    nextCursor: mtMap.objectField('next_cursor', mtMap.passthrough()),
    hasMore: mtMap.objectField('has_more', mtMap.passthrough()),
    lineCount: mtMap.objectField('line_count', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    truncated: mtMap.objectField('truncated', mtMap.passthrough())
  });

export type DashboardInstanceSandboxMachinesInstancesLogsQuery = {
  direction?: 'forward' | 'backward' | undefined;
  cursor?: number | undefined;
  limit?: number | undefined;
};

export let mapDashboardInstanceSandboxMachinesInstancesLogsQuery =
  mtMap.object<DashboardInstanceSandboxMachinesInstancesLogsQuery>({
    direction: mtMap.objectField('direction', mtMap.passthrough()),
    cursor: mtMap.objectField('cursor', mtMap.passthrough()),
    limit: mtMap.objectField('limit', mtMap.passthrough())
  });

