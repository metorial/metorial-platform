import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardScmInstallationsGetOutput = {
  object: 'integrations.scm.repo';
  id: string;
  provider: 'github';
  user: { id: string; name: string; email: string; imageUrl: string };
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardScmInstallationsGetOutput =
  mtMap.object<DashboardScmInstallationsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    provider: mtMap.objectField('provider', mtMap.passthrough()),
    user: mtMap.objectField(
      'user',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        email: mtMap.objectField('email', mtMap.passthrough()),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

