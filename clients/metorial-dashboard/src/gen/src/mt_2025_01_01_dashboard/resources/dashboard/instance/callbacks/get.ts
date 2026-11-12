import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceCallbacksGetOutput = {
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
  triggerGroupSelections: Record<string, Record<string, any>> | null;
  triggerGroups: {
    object: 'callback.trigger_group';
    key: string;
    name: string;
    description: string | null;
    selectionSchema: Record<string, any>;
    status: 'active' | 'selection_required';
  }[];
  createdAt: Date;
  updatedAt: Date;
  authCredentialsIsManaged: boolean;
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

export let mapDashboardInstanceCallbacksGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceCallbacksGetOutput>(
    [
      'integration_id',
      'integration_provider_id',
      ['provider', 0, 8],
      'trigger_group_selections',
      ['trigger_groups', 1, [2, [1, ['selection_schema']]]],
      'created_at',
      'updated_at',
      'auth_credentials_is_managed',
      ['sync', 0, [1, ['synced_at']]]
    ],
    1
  );
