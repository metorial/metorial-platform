import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsWebhookEventsListOutput = {
  object: 'list';
  items: { object: 'event.type'; name: string; description: string }[];
  pagination: {
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    before?: string | undefined;
    after?: string | undefined;
  };
};

export let mapDashboardOrganizationsWebhookEventsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsWebhookEventsListOutput>([
    7, 0
  ]);
