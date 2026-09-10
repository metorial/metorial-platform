import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbackInstancesGetOutput = {
  object: 'callback.instance';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  callbackId: string;
  integrationInstanceId: string;
  integrationInstanceProviderId: string;
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

export let mapDashboardInstanceCallbackInstancesGetOutput =
  mtMap.object<DashboardInstanceCallbackInstancesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    callbackId: mtMap.objectField('callback_id', mtMap.passthrough()),
    integrationInstanceId: mtMap.objectField(
      'integration_instance_id',
      mtMap.passthrough()
    ),
    integrationInstanceProviderId: mtMap.objectField(
      'integration_instance_provider_id',
      mtMap.passthrough()
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

