import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCustomProvidersDeploymentsGetLogsOutput = {
  object: 'custom_provider.deployment.logs';
  logs: { type: string; line: string; timestamp: Date | null }[];
  steps: {
    id: string | null;
    type: string | null;
    status: string | null;
    source: {
      provider: string | null;
      workflowRunId: string | null;
      workflowId: string | null;
      functionDeploymentId: string | null;
    } | null;
    logs: { type: string; line: string; timestamp: Date | null }[];
    createdAt: Date | null;
  }[];
};

export let mapManagementInstanceCustomProvidersDeploymentsGetLogsOutput =
  mtMap.object<ManagementInstanceCustomProvidersDeploymentsGetLogsOutput>({
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
    ),
    steps: mtMap.objectField(
      'steps',
      mtMap.array(
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          source: mtMap.objectField(
            'source',
            mtMap.object({
              provider: mtMap.objectField('provider', mtMap.passthrough()),
              workflowRunId: mtMap.objectField(
                'workflow_run_id',
                mtMap.passthrough()
              ),
              workflowId: mtMap.objectField('workflow_id', mtMap.passthrough()),
              functionDeploymentId: mtMap.objectField(
                'function_deployment_id',
                mtMap.passthrough()
              )
            })
          ),
          logs: mtMap.objectField(
            'logs',
            mtMap.array(
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                line: mtMap.objectField('line', mtMap.passthrough()),
                timestamp: mtMap.objectField('timestamp', mtMap.date())
              })
            )
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    )
  });

