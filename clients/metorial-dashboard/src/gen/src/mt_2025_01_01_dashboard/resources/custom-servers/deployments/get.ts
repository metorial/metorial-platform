import { mtMap } from '@metorial/util-resource-mapper';

export type CustomServersDeploymentsGetOutput = {
  object: 'custom_server.deployment';
  id: string;
  status: 'queued' | 'deploying' | 'completed' | 'failed';
  trigger: 'manual';
  creatorActor: {
    object: 'organization.actor';
    id: string;
    type: 'member' | 'machine_access';
    organizationId: string;
    name: string;
    email: string | null;
    imageUrl: string;
    createdAt: Date;
    updatedAt: Date;
  };
  customServerId: string;
  customServerVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  steps: {
    object: 'custom_server.deployment.step';
    id: string;
    index: number;
    status: 'running' | 'completed' | 'failed';
    type:
      | 'started'
      | 'remote_server_connection_test'
      | 'remote_oauth_auto_discovery'
      | 'deploying'
      | 'deployed'
      | 'lambda_deploy_build'
      | 'lambda_deploy_create'
      | 'discovering';
    logs: { timestamp: Date; line: string; type: 'info' | 'error' }[];
    createdAt: Date;
    startedAt: Date | null;
    endedAt: Date | null;
  }[];
};

export let mapCustomServersDeploymentsGetOutput =
  mtMap.object<CustomServersDeploymentsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    trigger: mtMap.objectField('trigger', mtMap.passthrough()),
    creatorActor: mtMap.objectField(
      'creator_actor',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        organizationId: mtMap.objectField(
          'organization_id',
          mtMap.passthrough()
        ),
        name: mtMap.objectField('name', mtMap.passthrough()),
        email: mtMap.objectField('email', mtMap.passthrough()),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    customServerId: mtMap.objectField('custom_server_id', mtMap.passthrough()),
    customServerVersionId: mtMap.objectField(
      'custom_server_version_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    startedAt: mtMap.objectField('started_at', mtMap.date()),
    endedAt: mtMap.objectField('ended_at', mtMap.date()),
    steps: mtMap.objectField(
      'steps',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          index: mtMap.objectField('index', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          logs: mtMap.objectField(
            'logs',
            mtMap.array(
              mtMap.object({
                timestamp: mtMap.objectField('timestamp', mtMap.date()),
                line: mtMap.objectField('line', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough())
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

