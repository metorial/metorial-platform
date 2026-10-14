import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSessionsErrorsGetOutput = {
  object: 'session.error';
  id: string;
  code: string;
  message: string;
  data: Record<string, any>;
  status: 'processing' | 'processed';
  sessionId: string;
  providerRunId: string | null;
  connectionId: string | null;
  groupId: string | null;
  similarErrorCount: number;
  createdAt: Date;
};

export let mapManagementInstanceSessionsErrorsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSessionsErrorsGetOutput>(
    [
      'session_id',
      'provider_run_id',
      'connection_id',
      'group_id',
      'similar_error_count',
      'created_at'
    ],
    1
  );
