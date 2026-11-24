import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationWebhookEventsListOutput = {
  items: { object: 'event.type'; name: string; description: string }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationWebhookEventsListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationWebhookEventsListOutput>([
    7, 0
  ]);
