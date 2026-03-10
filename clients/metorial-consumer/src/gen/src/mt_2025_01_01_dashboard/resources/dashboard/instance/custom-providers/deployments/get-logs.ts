import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomProvidersDeploymentsGetLogsOutput = {
  object: 'custom_provider.deployment.logs';
  customProviderDeploymentId: string;
  steps: {
    object: 'custom_provider.deployment.logs.step';
    id: string;
    name: string;
    type: string;
    status: string;
    logs: {
      object: 'custom_provider.deployment.logs.step.log';
      timestamp: Date;
      message: string;
    }[];
    createdAt: Date;
    startedAt: Date | null;
    endedAt: Date | null;
  }[];
};

export let mapDashboardInstanceCustomProvidersDeploymentsGetLogsOutput =
  mtMap.object<DashboardInstanceCustomProvidersDeploymentsGetLogsOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    customProviderDeploymentId: mtMap.objectField(
      'custom_provider_deployment_id',
      mtMap.passthrough()
    ),
    steps: mtMap.objectField(
      'steps',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          logs: mtMap.objectField(
            'logs',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                timestamp: mtMap.objectField('timestamp', mtMap.date()),
                message: mtMap.objectField('message', mtMap.passthrough())
              })
            )
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          startedAt: mtMap.objectField('started_at', mtMap.date()),
          endedAt: mtMap.objectField('ended_at', mtMap.date())
        })
      )
    )
  });

