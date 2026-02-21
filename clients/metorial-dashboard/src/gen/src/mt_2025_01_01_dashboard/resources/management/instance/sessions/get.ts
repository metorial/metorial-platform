import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionsGetOutput = {
  object: 'session';
  id: string;
  name: string | null;
  description: string | null;
  status: 'active' | 'deleted';
  connectionStatus: 'connected' | 'disconnected';
  usage: {
    totalProductiveMessageCount: number;
    totalProductiveClientMessageCount: number;
    totalProductiveServerMessageCount: number;
  };
  metadata: Record<string, any> | null;
  connectionUrl: string | null;
  connectionKey: string | null;
  providerDeployments: {
    object: 'session.provider_deployment#preview';
    id: string;
    name: string | null;
    providerId: string;
    providerDeploymentId: string | null;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSessionsGetOutput =
  mtMap.object<ManagementInstanceSessionsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    connectionStatus: mtMap.objectField(
      'connection_status',
      mtMap.passthrough()
    ),
    usage: mtMap.objectField(
      'usage',
      mtMap.object({
        totalProductiveMessageCount: mtMap.objectField(
          'total_productive_message_count',
          mtMap.passthrough()
        ),
        totalProductiveClientMessageCount: mtMap.objectField(
          'total_productive_client_message_count',
          mtMap.passthrough()
        ),
        totalProductiveServerMessageCount: mtMap.objectField(
          'total_productive_server_message_count',
          mtMap.passthrough()
        )
      })
    ),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    connectionUrl: mtMap.objectField('connection_url', mtMap.passthrough()),
    connectionKey: mtMap.objectField('connection_key', mtMap.passthrough()),
    providerDeployments: mtMap.objectField(
      'provider_deployments',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          providerDeploymentId: mtMap.objectField(
            'provider_deployment_id',
            mtMap.passthrough()
          )
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

