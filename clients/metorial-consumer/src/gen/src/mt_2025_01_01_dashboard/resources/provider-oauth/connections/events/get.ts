import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderOauthConnectionsEventsGetOutput = {
  object: 'provider_oauth.connection.event';
  id: string;
  status: 'active';
  type: 'errors' | 'config_auto_updated';
  metadata: Record<string, any>;
  connectionId: string;
  createdAt: Date;
};

export let mapProviderOauthConnectionsEventsGetOutput =
  mtMap.object<ProviderOauthConnectionsEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

