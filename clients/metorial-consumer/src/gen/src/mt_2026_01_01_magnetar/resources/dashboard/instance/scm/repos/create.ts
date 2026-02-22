import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceScmReposCreateOutput = {
  object: 'scm.repository';
  id: string;
  provider: {
    object: 'scm.provider';
    type: 'github' | 'gitlab';
    id: string;
    name: string;
    owner: string;
  };
  url: string;
  isPrivate: boolean;
  defaultBranch: string;
  createdAt: Date;
};

export let mapDashboardInstanceScmReposCreateOutput =
  mtMap.object<DashboardInstanceScmReposCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    provider: mtMap.objectField(
      'provider',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        owner: mtMap.objectField('owner', mtMap.passthrough())
      })
    ),
    url: mtMap.objectField('url', mtMap.passthrough()),
    isPrivate: mtMap.objectField('is_private', mtMap.passthrough()),
    defaultBranch: mtMap.objectField('default_branch', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

export type DashboardInstanceScmReposCreateBody = {
  installationId: string;
  externalRepoId?: string | undefined;
  externalAccountId?: string | undefined;
  name?: string | undefined;
  isPrivate?: boolean | undefined;
};

export let mapDashboardInstanceScmReposCreateBody =
  mtMap.object<DashboardInstanceScmReposCreateBody>({
    installationId: mtMap.objectField('installation_id', mtMap.passthrough()),
    externalRepoId: mtMap.objectField('external_repo_id', mtMap.passthrough()),
    externalAccountId: mtMap.objectField(
      'external_account_id',
      mtMap.passthrough()
    ),
    name: mtMap.objectField('name', mtMap.passthrough()),
    isPrivate: mtMap.objectField('is_private', mtMap.passthrough())
  });

