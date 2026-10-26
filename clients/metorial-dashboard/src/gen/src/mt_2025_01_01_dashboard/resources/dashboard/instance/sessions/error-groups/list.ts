import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSessionsErrorGroupsListOutput = {
  items: {
    object: 'session.error_group';
    id: string;
    code: string;
    message: string;
    data: Record<string, any>;
    providerId: string | null;
    occurrenceCount: number;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSessionsErrorGroupsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSessionsErrorGroupsListOutput>(
    [7, [1, ['provider_id', 'occurrence_count', 'created_at']]],
    1
  );

export type DashboardInstanceSessionsErrorGroupsListQuery = {
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
  providerId?: string | string[] | undefined;
  search?: string | undefined;
};

export let mapDashboardInstanceSessionsErrorGroupsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSessionsErrorGroupsListQuery>([
    3,
    [[0, [1, ['session_id', 'provider_id']]]]
  ]);
