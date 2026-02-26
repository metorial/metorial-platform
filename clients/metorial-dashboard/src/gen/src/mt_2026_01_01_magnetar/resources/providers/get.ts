import { mtMap } from '@metorial/util-resource-mapper';

export type ProvidersGetOutput = {
  object: 'provider';
  id: string;
  access: string;
  status: string;
  publisher: {
    object: 'provider.publisher';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    imageUrl: string;
    createdAt: Date;
    updatedAt: Date;
  };
  currentVersion: {
    object: 'provider.version';
    id: string;
    version: string;
    providerId: string;
    isCurrent: boolean;
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    specificationId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  oauth: {
    status: string;
    callbackUrl: string | null;
    autoRegistration: { status: 'enabled' | 'disabled' };
  } | null;
  identifier: string;
  name: string;
  description: string | null;
  slug: string;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProvidersGetOutput = mtMap.object<ProvidersGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  access: mtMap.objectField('access', mtMap.passthrough()),
  status: mtMap.objectField('status', mtMap.passthrough()),
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
      providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
      isCurrent: mtMap.objectField('is_current', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      specificationId: mtMap.objectField(
        'specification_id',
        mtMap.passthrough()
      ),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date())
    })
  ),
  oauth: mtMap.objectField(
    'oauth',
    mtMap.object({
      status: mtMap.objectField('status', mtMap.passthrough()),
      callbackUrl: mtMap.objectField('callback_url', mtMap.passthrough()),
      autoRegistration: mtMap.objectField(
        'auto_registration',
        mtMap.object({
          status: mtMap.objectField('status', mtMap.passthrough())
        })
      )
    })
  ),
  identifier: mtMap.objectField('identifier', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  slug: mtMap.objectField('slug', mtMap.passthrough()),
  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});

