import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderRunsGetLogsOutput = {
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

export let mapProviderRunsGetLogsOutput =
  mtMap.object<ProviderRunsGetLogsOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    providerRunId: mtMap.objectField('provider_run_id', mtMap.passthrough()),
    logs: mtMap.objectField(
      'logs',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          timestamp: mtMap.objectField('timestamp', mtMap.date()),
          message: mtMap.objectField('message', mtMap.passthrough()),
          outputType: mtMap.objectField('output_type', mtMap.passthrough())
        })
      )
    )
  });

