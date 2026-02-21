import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceScmReposPreviewOutput = {
  items: {
    object: 'scm.repo_preview';
    provider: string;
    externalId: string;
    name: string;
    identifier: string;
    lastPushedAt: Date | null;
    account: {
      externalId: string;
      name: string;
      identifier: string;
      provider: string;
    } | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceScmReposPreviewOutput =
  mtMap.object<DashboardInstanceScmReposPreviewOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          provider: mtMap.objectField('provider', mtMap.passthrough()),
          externalId: mtMap.objectField('external_id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          lastPushedAt: mtMap.objectField('last_pushed_at', mtMap.date()),
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

export type DashboardInstanceScmReposPreviewBody = {
  installationId: string;
  externalAccountId?: string | undefined;
};

export let mapDashboardInstanceScmReposPreviewBody =
  mtMap.object<DashboardInstanceScmReposPreviewBody>({
    installationId: mtMap.objectField('installation_id', mtMap.passthrough()),
    externalAccountId: mtMap.objectField(
      'external_account_id',
      mtMap.passthrough()
    )
  });

