import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsKeyProvidersGetSetupInfoOutput = {
  object: 'key_provider_setup_info';
  steps: {
    title: string;
    description: string;
    markdown?: string | undefined;
    inputs?:
      | {
          type: 'text' | 'json';
          key: string;
          label: string;
          description: string;
        }[]
      | undefined;
  }[];
};

export let mapDashboardProjectsKeyProvidersGetSetupInfoOutput =
  mtMap.object<DashboardProjectsKeyProvidersGetSetupInfoOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    steps: mtMap.objectField(
      'steps',
      mtMap.array(
        mtMap.object({
          title: mtMap.objectField('title', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          markdown: mtMap.objectField('markdown', mtMap.passthrough()),
          inputs: mtMap.objectField(
            'inputs',
            mtMap.array(
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                key: mtMap.objectField('key', mtMap.passthrough()),
                label: mtMap.objectField('label', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                )
              })
            )
          )
        })
      )
    )
  });

export type DashboardProjectsKeyProvidersGetSetupInfoQuery = {
  region?: string | undefined;
  keyId?: string | undefined;
};

export let mapDashboardProjectsKeyProvidersGetSetupInfoQuery =
  mtMap.object<DashboardProjectsKeyProvidersGetSetupInfoQuery>({
    region: mtMap.objectField('region', mtMap.passthrough()),
    keyId: mtMap.objectField('key_id', mtMap.passthrough())
  });

