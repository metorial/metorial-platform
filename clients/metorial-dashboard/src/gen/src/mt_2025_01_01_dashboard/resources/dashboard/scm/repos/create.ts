import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardScmReposCreateOutput = {
  object: 'integrations.scm.repo';
  id: string;
  provider: 'github';
  name: string;
  identifier: string;
  externalId: string;
  account: {
    id: string;
    externalId: string;
    name: string;
    identifier: string;
    provider: 'github';
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardScmReposCreateOutput =
  mtMap.object<DashboardScmReposCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    provider: mtMap.objectField('provider', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
    externalId: mtMap.objectField('external_id', mtMap.passthrough()),
    account: mtMap.objectField(
      'account',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        externalId: mtMap.objectField('external_id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        provider: mtMap.objectField('provider', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardScmReposCreateBody =
  | { installationId: string; externalRepoId: string }
  | {
      installationId: string;
      externalAccountId: string;
      name: string;
      description?: string | undefined;
      isPrivate: boolean;
    };

export let mapDashboardScmReposCreateBody = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      installationId: mtMap.objectField('installation_id', mtMap.passthrough()),
      externalRepoId: mtMap.objectField(
        'external_repo_id',
        mtMap.passthrough()
      ),
      externalAccountId: mtMap.objectField(
        'external_account_id',
        mtMap.passthrough()
      ),
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      isPrivate: mtMap.objectField('is_private', mtMap.passthrough())
    })
  )
]);

