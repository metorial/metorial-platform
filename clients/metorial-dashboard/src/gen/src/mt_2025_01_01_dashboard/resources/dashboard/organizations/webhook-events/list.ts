import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsWebhookEventsListOutput = {
  items: { object: 'event.type'; name: string; description: string }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsWebhookEventsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsWebhookEventsListOutput>([
    7, 0
  ]);
