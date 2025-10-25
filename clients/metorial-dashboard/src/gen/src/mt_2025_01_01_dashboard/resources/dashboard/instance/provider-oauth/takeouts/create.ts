import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderOauthTakeoutsCreateOutput = {
  object: 'provider_oauth.takeout';
  id: string;
  status: 'active' | 'expired';
  note: string | null;
  metadata: Record<string, any>;
  accessToken: string | null;
  idToken: string | null;
  scope: string | null;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapDashboardInstanceProviderOauthTakeoutsCreateOutput =
  mtMap.object<DashboardInstanceProviderOauthTakeoutsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    note: mtMap.objectField('note', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    accessToken: mtMap.objectField('access_token', mtMap.passthrough()),
    idToken: mtMap.objectField('id_token', mtMap.passthrough()),
    scope: mtMap.objectField('scope', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type DashboardInstanceProviderOauthTakeoutsCreateBody = {
  note?: string | undefined;
  metadata?: Record<string, any> | undefined;
  oauthSessionId: string;
};

export let mapDashboardInstanceProviderOauthTakeoutsCreateBody =
  mtMap.object<DashboardInstanceProviderOauthTakeoutsCreateBody>({
    note: mtMap.objectField('note', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    oauthSessionId: mtMap.objectField('oauth_session_id', mtMap.passthrough())
  });

