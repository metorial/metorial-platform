import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCallbacksUpdateOutput = {
  object: 'callback';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  integrationId: string;
  integrationProviderId: string;
  provider: {
    object: 'provider#preview';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  sync: {
    object: 'callback.sync';
    status: 'pending' | 'synced' | 'failed';
    error: {
      object: 'callback.sync.error';
      code: string;
      message: string | null;
    } | null;
    syncedAt: Date | null;
  };
};

export let mapManagementInstanceCallbacksUpdateOutput =
  mtMap.object<ManagementInstanceCallbacksUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    integrationId: mtMap.objectField('integration_id', mtMap.passthrough()),
    integrationProviderId: mtMap.objectField(
      'integration_provider_id',
      mtMap.passthrough()
    ),
    provider: mtMap.objectField(
      'provider',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    sync: mtMap.objectField(
      'sync',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        error: mtMap.objectField(
          'error',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            code: mtMap.objectField('code', mtMap.passthrough()),
            message: mtMap.objectField('message', mtMap.passthrough())
          })
        ),
        syncedAt: mtMap.objectField('synced_at', mtMap.date())
      })
    )
  });

export type ManagementInstanceCallbacksUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  metadata?: Record<string, any> | null | undefined;
};

export let mapManagementInstanceCallbacksUpdateBody =
  mtMap.object<ManagementInstanceCallbacksUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough())
  });

