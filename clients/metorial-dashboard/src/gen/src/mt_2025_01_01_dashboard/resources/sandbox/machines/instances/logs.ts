import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<SandboxMachinesInstancesLogsOutput>({
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

export type SandboxMachinesInstancesLogsQuery = {
  direction?: 'forward' | 'backward' | undefined;
  cursor?: number | undefined;
  limit?: number | undefined;
};

export let mapSandboxMachinesInstancesLogsQuery =
  mtMap.object<SandboxMachinesInstancesLogsQuery>({
    direction: mtMap.objectField('direction', mtMap.passthrough()),
    cursor: mtMap.objectField('cursor', mtMap.passthrough()),
    limit: mtMap.objectField('limit', mtMap.passthrough())
  });

