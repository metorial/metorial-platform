import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ScmInstallationListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapScmInstallationListOutput =
  /* @__PURE__ */ createMapper<ScmInstallationListOutput>(
    [
      7,
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
    1
  );

export type ScmInstallationListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapScmInstallationListQuery =
  /* @__PURE__ */ createMapper<ScmInstallationListQuery>(0);
