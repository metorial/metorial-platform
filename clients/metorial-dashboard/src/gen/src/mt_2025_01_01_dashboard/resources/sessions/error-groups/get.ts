import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SessionsErrorGroupsGetOutput = {
  object: 'session.error_group';
  id: string;
  code: string;
  message: string;
  data: Record<string, any>;
  providerId: string | null;
  occurrenceCount: number;
  createdAt: Date;
};

export let mapSessionsErrorGroupsGetOutput =
  /* @__PURE__ */ mapObject<SessionsErrorGroupsGetOutput>(
    ['provider_id', 'occurrence_count', 'created_at'],
    1
  );
