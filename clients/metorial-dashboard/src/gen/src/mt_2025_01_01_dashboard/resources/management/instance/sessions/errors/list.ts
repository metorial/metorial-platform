import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSessionsErrorsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSessionsErrorsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSessionsErrorsListOutput>(
    [
      7,
      [
        1,
        [
          'session_id',
          'provider_run_id',
          'connection_id',
          'group_id',
          'similar_error_count',
          'created_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceSessionsErrorsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  type?:
    | 'message_processing_timeout'
    | 'message_processing_provider_error'
    | 'message_processing_system_error'
    | (
        | 'message_processing_timeout'
        | 'message_processing_provider_error'
        | 'message_processing_system_error'
      )[]
    | undefined;
  id?: string | string[] | undefined;
  sessionId?: string | string[] | undefined;
  sessionProviderId?: string | string[] | undefined;
  sessionConnectionId?: string | string[] | undefined;
  sessionErrorGroupId?: string | string[] | undefined;
  providerRunId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  sessionMessageId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceSessionsErrorsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSessionsErrorsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'session_id',
            'session_provider_id',
            'session_connection_id',
            'session_error_group_id',
            'provider_run_id',
            'provider_id',
            'session_message_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
