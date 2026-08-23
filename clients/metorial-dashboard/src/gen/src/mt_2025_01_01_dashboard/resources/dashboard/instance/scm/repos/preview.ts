import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceScmReposPreviewOutput = {
  object: 'scm.repository.list#preview';
  repos: {
    object: 'scm.repository.item#preview';
    provider: 'github' | 'gitlab' | 'bitbucket';
    externalId: string;
    name: string;
    identifier: string;
  }[];
  nextCursor?: string | undefined;
};

export let mapDashboardInstanceScmReposPreviewOutput =
  mtMap.object<DashboardInstanceScmReposPreviewOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    repos: mtMap.objectField(
      'repos',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          provider: mtMap.objectField('provider', mtMap.passthrough()),
          externalId: mtMap.objectField('external_id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough())
        })
      )
    ),
    nextCursor: mtMap.objectField('next_cursor', mtMap.passthrough())
  });

export type DashboardInstanceScmReposPreviewBody = {
  installationId: string;
  externalAccountId?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
};

export let mapDashboardInstanceScmReposPreviewBody =
  mtMap.object<DashboardInstanceScmReposPreviewBody>({
    installationId: mtMap.objectField('installation_id', mtMap.passthrough()),
    externalAccountId: mtMap.objectField(
      'external_account_id',
      mtMap.passthrough()
    ),
    cursor: mtMap.objectField('cursor', mtMap.passthrough()),
    limit: mtMap.objectField('limit', mtMap.passthrough())
  });

