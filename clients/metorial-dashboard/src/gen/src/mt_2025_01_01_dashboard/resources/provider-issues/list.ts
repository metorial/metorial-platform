import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProviderIssuesListOutput = {
  items: {
    object: 'provider.issue';
    id: string;
    type: 'provider_error' | 'auth_error' | 'protoguard_warning';
    subtype: string;
    severity: 'warning' | 'error' | 'critical';
    code: string;
    message: string;
    providerId: string | null;
    protoguardFilterId: string | null;
    occurrenceCount: number;
    dailyOccurrences: { startsAt: Date; endsAt: Date; count: number }[];
    firstSeenAt: Date;
    lastSeenAt: Date;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapProviderIssuesListOutput =
  /* @__PURE__ */ createMapper<ProviderIssuesListOutput>(
    [
      7,
      [
        1,
        [
          'provider_id',
          'protoguard_filter_id',
          'occurrence_count',
          ['daily_occurrences', 1, [2, [1, ['starts_at', 'ends_at']]]],
          'first_seen_at',
          'last_seen_at',
          'created_at'
        ]
      ]
    ],
    1
  );

export type ProviderIssuesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  type?:
    | 'provider_error'
    | 'auth_error'
    | 'protoguard_warning'
    | ('provider_error' | 'auth_error' | 'protoguard_warning')[]
    | undefined;
  severity?:
    | 'warning'
    | 'error'
    | 'critical'
    | ('warning' | 'error' | 'critical')[]
    | undefined;
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  lastSeenAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  search?: string | undefined;
};

export let mapProviderIssuesListQuery =
  /* @__PURE__ */ createMapper<ProviderIssuesListQuery>([
    3,
    [[0, [1, ['provider_id', ['last_seen_at', 1, 5], ['created_at', 1, 5]]]]]
  ]);
