import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ScmInstallationCreateOutput = {
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

export let mapScmInstallationCreateOutput =
  /* @__PURE__ */ mapObject<ScmInstallationCreateOutput>(
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

export type ScmInstallationCreateBody = { redirectUrl?: string | undefined };

export let mapScmInstallationCreateBody =
  /* @__PURE__ */ mapObject<ScmInstallationCreateBody>(['redirect_url']);
