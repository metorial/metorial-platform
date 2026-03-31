import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceScmConnectionsCreateOutput = {
  object: 'scm.connection.setup_session';
  id: string;
  url: string;
  status: 'pending' | 'completed' | 'expired';
  connection: {
    object: 'scm.connection';
    id: string;
    provider: 'github' | 'gitlab';
    externalInstallationId: string | null;
    accountType: 'user' | 'organization' | null;
    externalAccount: {
      id: string;
      login: string;
      name: string | null;
      email: string | null;
      imageUrl: string | null;
    };
    createdAt: Date;
    updatedAt: Date;
  } | null;
  createdAt: Date;
  expiresAt: Date;
};

export let mapDashboardInstanceScmConnectionsCreateOutput =
  mtMap.object<DashboardInstanceScmConnectionsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    connection: mtMap.objectField(
      'connection',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        provider: mtMap.objectField('provider', mtMap.passthrough()),
        externalInstallationId: mtMap.objectField(
          'external_installation_id',
          mtMap.passthrough()
        ),
        accountType: mtMap.objectField('account_type', mtMap.passthrough()),
        externalAccount: mtMap.objectField(
          'external_account',
          mtMap.object({
            id: mtMap.objectField('id', mtMap.passthrough()),
            login: mtMap.objectField('login', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            email: mtMap.objectField('email', mtMap.passthrough()),
            imageUrl: mtMap.objectField('image_url', mtMap.passthrough())
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type DashboardInstanceScmConnectionsCreateBody = {
  redirectUrl?: string | undefined;
};

export let mapDashboardInstanceScmConnectionsCreateBody =
  mtMap.object<DashboardInstanceScmConnectionsCreateBody>({
    redirectUrl: mtMap.objectField('redirect_url', mtMap.passthrough())
  });

