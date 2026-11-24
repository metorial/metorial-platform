import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsKeyProvidersErrorsListOutput = {
  items: {
    object: 'key_provider_error';
    id: string;
    day: Date;
    operation:
      | 'create_system_provider'
      | 'validate_provider'
      | 'generate_data_key'
      | 'decrypt_data_key';
    code: string;
    count: number;
    sampleMessage: string | null;
    firstSeenAt: Date;
    lastSeenAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardProjectsKeyProvidersErrorsListOutput =
  /* @__PURE__ */ createMapper<DashboardProjectsKeyProvidersErrorsListOutput>(
    [
      7,
      [1, [['day', 0, 4], 'sample_message', 'first_seen_at', 'last_seen_at']]
    ],
    1
  );

export type DashboardProjectsKeyProvidersErrorsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardProjectsKeyProvidersErrorsListQuery =
  /* @__PURE__ */ createMapper<DashboardProjectsKeyProvidersErrorsListQuery>(0);
