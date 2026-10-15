import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceScmConnectionsCreateOutput = {
  object: 'scm.connection.setup_session';
  id: string;
  url: string;
  status: 'pending' | 'completed' | 'expired';
  connection: {
    object: 'scm.connection';
    id: string;
    provider: 'github' | 'gitlab' | 'bitbucket';
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
  /* @__PURE__ */ mapObject<DashboardInstanceScmConnectionsCreateOutput>(
    [
      [
        'connection',
        0,
        [
          1,
          [
            'external_installation_id',
            'account_type',
            ['external_account', 1, [1, ['image_url']]],
            'created_at',
            'updated_at'
          ]
        ]
      ],
      'created_at',
      'expires_at'
    ],
    1
  );

export type DashboardInstanceScmConnectionsCreateBody = {
  redirectUrl?: string | undefined;
};

export let mapDashboardInstanceScmConnectionsCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceScmConnectionsCreateBody>([
    'redirect_url'
  ]);
