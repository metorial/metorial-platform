import { mtMap } from '@metorial/util-resource-mapper';

export type CustomProvidersDeploymentsGetLogsOutput = {
  object: 'custom_provider.deployment.logs';
  logs: { type: string; line: string; timestamp: Date | null }[];
};

export let mapCustomProvidersDeploymentsGetLogsOutput =
  mtMap.object<CustomProvidersDeploymentsGetLogsOutput>({
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

