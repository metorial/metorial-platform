import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderOauthTokenImportsUpdateOutput = {
  object: 'provider_oauth.import';
  id: string;
  status: 'active' | 'expired';
  note: string | null;
  metadata: Record<string, any>;
  connectionId: string;
  idToken: string | null;
  scope: string | null;
  tokenType: string | null;
  identifier: string | null;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapProviderOauthTokenImportsUpdateOutput =
  mtMap.object<ProviderOauthTokenImportsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    note: mtMap.objectField('note', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
    idToken: mtMap.objectField('id_token', mtMap.passthrough()),
    scope: mtMap.objectField('scope', mtMap.passthrough()),
    tokenType: mtMap.objectField('token_type', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type ProviderOauthTokenImportsUpdateBody = {
  note?: string | undefined;
  metadata?: Record<string, any> | undefined;
  accessToken?: string | undefined;
  expiresAt?: Date | undefined;
  idToken?: string | undefined;
  scope?: string | undefined;
  tokenType?: string | undefined;
};

export let mapProviderOauthTokenImportsUpdateBody =
  mtMap.object<ProviderOauthTokenImportsUpdateBody>({
    note: mtMap.objectField('note', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    accessToken: mtMap.objectField('access_token', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date()),
    idToken: mtMap.objectField('id_token', mtMap.passthrough()),
    scope: mtMap.objectField('scope', mtMap.passthrough()),
    tokenType: mtMap.objectField('token_type', mtMap.passthrough())
  });

