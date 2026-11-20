import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingMembersListOutput = {
  items: {
    object: 'agent_tracking.member';
    id: string;
    name: string | null;
    email: string | null;
    emails: string[];
    matched: boolean;
    consumer: { id: string | null; name: string; email: string } | null;
    needsReview: boolean;
    lastSeenAt: Date;
    sessions: number;
    listTruncated: boolean;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceAgentTrackingMembersListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceAgentTrackingMembersListOutput>(
    [7, [1, ['needs_review', 'last_seen_at', 'list_truncated']]],
    1
  );

export type DashboardInstanceAgentTrackingMembersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceAgentTrackingMembersListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceAgentTrackingMembersListQuery>(0);
