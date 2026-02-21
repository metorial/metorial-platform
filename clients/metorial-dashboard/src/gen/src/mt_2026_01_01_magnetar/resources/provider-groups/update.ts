import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderGroupsUpdateOutput = {
  object: 'provider.group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderGroupsUpdateOutput =
  mtMap.object<ProviderGroupsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ProviderGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
};

export let mapProviderGroupsUpdateBody = mtMap.object<ProviderGroupsUpdateBody>(
  {
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough())
  }
);

