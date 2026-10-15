import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceCustomProvidersDeploymentsGetLogsOutput = {
  object: 'custom_provider.deployment.logs';
  customProviderDeploymentId: string;
  steps: {
    object: 'custom_provider.deployment.logs.step';
    id: string;
    name: string;
    type: string;
    status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';
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
  /* @__PURE__ */ mapObject<DashboardInstanceCustomProvidersDeploymentsGetLogsOutput>(
    [
      'custom_provider_deployment_id',
      [
        'steps',
        0,
        [
          2,
          [
            1,
            [
              ['logs', 0, [2, [1, [['timestamp', 0, 4]]]]],
              'created_at',
              'started_at',
              'ended_at'
            ]
          ]
        ]
      ]
    ],
    1
  );
