import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCustomProvidersGetOutput = {
  object: 'custom_provider';
  id: string;
  status: string | null;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  provider: {
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
      imageUrl: string;
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
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceCustomProvidersGetOutput =
  mtMap.object<ManagementInstanceCustomProvidersGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    provider: mtMap.objectField(
      'provider',
      mtMap.object({
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
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

