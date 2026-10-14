import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderRunsGetLogsOutput = {
  object: 'session.provider_run.logs';
  providerRunId: string;
  logs: {
    object: 'session.provider_run.item';
    timestamp: Date;
    message: string;
    outputType:
      | 'stdout'
      | 'stderr'
      | 'debug.info'
      | 'debug.warning'
      | 'debug.error';
  }[];
};

export let mapDashboardInstanceProviderRunsGetLogsOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderRunsGetLogsOutput>([
    'provider_run_id',
    ['logs', 0, [2, [1, [['timestamp', 0, 4], 'output_type']]]]
  ]);
