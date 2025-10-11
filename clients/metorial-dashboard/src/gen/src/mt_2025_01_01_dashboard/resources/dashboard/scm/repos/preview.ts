import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardScmReposPreviewOutput = {
  object: 'integrations.scm.repo#preview';
  items: {
    provider: 'github';
    name: string;
    identifier: string;
    externalId: string;
    createdAt: Date;
    updatedAt: Date;
    lastPushedAt: Date | null;
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
          externalId: mtMap.objectField('external_id', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          lastPushedAt: mtMap.objectField('lastPushed_at', mtMap.date()),
          account: mtMap.objectField(
            'account',
            mtMap.object({
              externalId: mtMap.objectField('external_id', mtMap.passthrough()),
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
  externalAccountId: string;
};

export let mapDashboardScmReposPreviewQuery =
  mtMap.object<DashboardScmReposPreviewQuery>({
    installationId: mtMap.objectField('installation_id', mtMap.passthrough()),
    externalAccountId: mtMap.objectField(
      'external_account_id',
      mtMap.passthrough()
    )
  });

