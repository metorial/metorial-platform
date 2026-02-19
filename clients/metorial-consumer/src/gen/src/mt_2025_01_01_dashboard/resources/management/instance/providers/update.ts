import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProvidersUpdateOutput = {
  object: 'provider';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  publisher: {
    object: 'provider.publisher';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    imageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  currentVersion: {
    object: 'provider.version';
    id: string;
    version: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProvidersUpdateOutput =
  mtMap.object<ManagementInstanceProvidersUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    publisher: mtMap.objectField(
      'publisher',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    currentVersion: mtMap.objectField(
      'current_version',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        version: mtMap.objectField('version', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceProvidersUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  slug?: string | undefined;
  image?: string | undefined;
  skills?: string[] | undefined;
};

export let mapManagementInstanceProvidersUpdateBody =
  mtMap.object<ManagementInstanceProvidersUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    image: mtMap.objectField('image', mtMap.passthrough()),
    skills: mtMap.objectField('skills', mtMap.array(mtMap.passthrough()))
  });
