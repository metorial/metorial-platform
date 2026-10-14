import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ScmConnectionsGetOutput = {
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
};

export let mapScmConnectionsGetOutput =
  /* @__PURE__ */ mapObject<ScmConnectionsGetOutput>(
    [
      'external_installation_id',
      'account_type',
      ['external_account', 1, [1, ['image_url']]],
      'created_at',
      'updated_at'
    ],
    1
  );
