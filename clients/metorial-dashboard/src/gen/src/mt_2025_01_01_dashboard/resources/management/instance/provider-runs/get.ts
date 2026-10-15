import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderRunsGetOutput = {
  object: 'session.provider_run';
  id: string;
  status: 'running' | 'stopped';
  sessionId: string;
  sessionProviderId: string;
  providerId: string;
  connectionId: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderRunsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderRunsGetOutput>(
    [
      'session_id',
      'session_provider_id',
      'provider_id',
      'connection_id',
      'completed_at',
      'created_at',
      'updated_at'
    ],
    1
  );
