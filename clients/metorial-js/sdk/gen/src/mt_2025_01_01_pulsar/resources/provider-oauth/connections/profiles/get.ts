import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderOauthConnectionsProfilesGetOutput = {
  object: 'provider_oauth.connection.profile';
  id: string;
  status: 'active';
  sub: string;
  name: string | null;
  email: string | null;
  connectionId: string;
  createdAt: Date;
  lastUsedAt: Date;
  updatedAt: Date;
};

export let mapProviderOauthConnectionsProfilesGetOutput =
  mtMap.object<ProviderOauthConnectionsProfilesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    sub: mtMap.objectField('sub', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough()),
    connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    lastUsedAt: mtMap.objectField('last_used_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

