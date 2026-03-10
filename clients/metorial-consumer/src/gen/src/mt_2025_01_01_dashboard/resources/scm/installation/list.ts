import { mtMap } from '@metorial/util-resource-mapper';

export type ScmInstallationListOutput = {
  items: {
    object: 'scm.connection';
    id: string;
    provider: string;
    externalInstallationId: string | null;
    accountType: string | null;
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
  mtMap.object<ScmInstallationListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
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
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type ScmInstallationListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapScmInstallationListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

