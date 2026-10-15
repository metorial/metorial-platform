import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSessionsErrorGroupsGetOutput = {
  object: 'session.error_group';
  id: string;
  code: string;
  message: string;
  data: Record<string, any>;
  providerId: string | null;
  occurrenceCount: number;
  createdAt: Date;
};

export let mapDashboardInstanceSessionsErrorGroupsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSessionsErrorGroupsGetOutput>(
    ['provider_id', 'occurrence_count', 'created_at'],
    1
  );
