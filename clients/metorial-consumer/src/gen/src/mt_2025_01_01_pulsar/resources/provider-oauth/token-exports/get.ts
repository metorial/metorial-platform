import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderOauthTokenExportsGetOutput = {
  object: 'provider_oauth.export';
  id: string;
  status: 'active' | 'expired';
  note: string | null;
  metadata: Record<string, any>;
  connectionId: string;
  accessToken: string | null;
  idToken: string | null;
  scope: string | null;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapProviderOauthTokenExportsGetOutput =
  mtMap.object<ProviderOauthTokenExportsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    note: mtMap.objectField('note', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
    accessToken: mtMap.objectField('access_token', mtMap.passthrough()),
    idToken: mtMap.objectField('id_token', mtMap.passthrough()),
    scope: mtMap.objectField('scope', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

