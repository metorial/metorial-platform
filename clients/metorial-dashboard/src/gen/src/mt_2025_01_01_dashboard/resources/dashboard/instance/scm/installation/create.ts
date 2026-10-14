import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceScmInstallationCreateOutput = {
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

export let mapDashboardInstanceScmInstallationCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceScmInstallationCreateOutput>(
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

export type DashboardInstanceScmInstallationCreateBody = {
  redirectUrl?: string | undefined;
};

export let mapDashboardInstanceScmInstallationCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceScmInstallationCreateBody>([
    'redirect_url'
  ]);
