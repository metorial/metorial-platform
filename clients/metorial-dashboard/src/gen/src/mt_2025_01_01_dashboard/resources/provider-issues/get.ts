import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ProviderIssuesGetOutput = {
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
};

export let mapProviderIssuesGetOutput =
  /* @__PURE__ */ mapObject<ProviderIssuesGetOutput>(
    [
      'provider_id',
      'protoguard_filter_id',
      'occurrence_count',
      ['daily_occurrences', 1, [2, [1, ['starts_at', 'ends_at']]]],
      'first_seen_at',
      'last_seen_at',
      'created_at'
    ],
    1
  );
