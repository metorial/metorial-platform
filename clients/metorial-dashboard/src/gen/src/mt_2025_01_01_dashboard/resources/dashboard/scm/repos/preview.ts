import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardScmReposPreviewOutput = {
  object: 'integrations.scm.repo#preview';
  items: {
    provider: 'github';
    name: string;
    identifier: string;
    externalId: string;
    account: {
      externalId: string;
      name: string;
      identifier: string;
      provider: 'github';
    };
  }[];
};

export let mapDashboardScmReposPreviewOutput =
  mtMap.object<DashboardScmReposPreviewOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          provider: mtMap.objectField('provider', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          externalId: mtMap.objectField('externalId', mtMap.passthrough()),
          account: mtMap.objectField(
            'account',
            mtMap.object({
              externalId: mtMap.objectField('externalId', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              identifier: mtMap.objectField('identifier', mtMap.passthrough()),
              provider: mtMap.objectField('provider', mtMap.passthrough())
            })
          )
        })
      )
    )
  });

export type DashboardScmReposPreviewQuery = {
  installationId: string;
  search: string;
};

export let mapDashboardScmReposPreviewQuery =
  mtMap.object<DashboardScmReposPreviewQuery>({
    installationId: mtMap.objectField('installationId', mtMap.passthrough()),
    search: mtMap.objectField('search', mtMap.passthrough())
  });

