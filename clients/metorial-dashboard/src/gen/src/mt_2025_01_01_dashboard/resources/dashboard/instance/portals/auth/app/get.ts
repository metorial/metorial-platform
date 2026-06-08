import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstancePortalsAuthAppGetOutput = {
  object: 'portal.auth.app';
  id: string;
  slug: string | null;
  emailWhitelist: string[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePortalsAuthAppGetOutput =
  mtMap.object<DashboardInstancePortalsAuthAppGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    emailWhitelist: mtMap.objectField(
      'email_whitelist',
      mtMap.array(mtMap.passthrough())
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

