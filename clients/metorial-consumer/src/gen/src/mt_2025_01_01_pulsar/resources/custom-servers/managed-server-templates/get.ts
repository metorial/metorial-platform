import { mtMap } from '@metorial/util-resource-mapper';

export type CustomServersManagedServerTemplatesGetOutput = {
  object: 'managed_server.template';
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
};

export let mapCustomServersManagedServerTemplatesGetOutput =
  mtMap.object<CustomServersManagedServerTemplatesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

