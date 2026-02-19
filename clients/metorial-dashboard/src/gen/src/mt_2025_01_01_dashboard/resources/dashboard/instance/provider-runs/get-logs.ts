import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderRunsGetLogsOutput = {
  object: 'session.provider_run.logs';
  logs: { type: string; line: string; timestamp: Date | null }[];
};

export let mapDashboardInstanceProviderRunsGetLogsOutput =
  mtMap.object<DashboardInstanceProviderRunsGetLogsOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    logs: mtMap.objectField(
      'logs',
      mtMap.array(
        mtMap.object({
          type: mtMap.objectField('type', mtMap.passthrough()),
          line: mtMap.objectField('line', mtMap.passthrough()),
          timestamp: mtMap.objectField('timestamp', mtMap.date())
        })
      )
    )
  });
