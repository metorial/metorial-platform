import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardScmAccountsPreviewOutput = {
  object: 'integrations.scm.account#preview';
  items: {
    provider: 'github';
    name: string;
    identifier: string;
    externalId: string;
  }[];
};

export let mapDashboardScmAccountsPreviewOutput =
  mtMap.object<DashboardScmAccountsPreviewOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          provider: mtMap.objectField('provider', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          externalId: mtMap.objectField('external_id', mtMap.passthrough())
        })
      )
    )
  });

export type DashboardScmAccountsPreviewQuery = { installationId: string };

export let mapDashboardScmAccountsPreviewQuery =
  mtMap.object<DashboardScmAccountsPreviewQuery>({
    installationId: mtMap.objectField('installation_id', mtMap.passthrough())
  });

