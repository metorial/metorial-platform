import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceCallbackInstancesGetOutput = {
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

export let mapManagementInstanceCallbackInstancesGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceCallbackInstancesGetOutput>(
    [
      'callback_id',
      'integration_instance_id',
      'integration_instance_provider_id',
      'created_at',
      'updated_at',
      ['sync', 0, [1, ['synced_at']]]
    ],
    1
  );
