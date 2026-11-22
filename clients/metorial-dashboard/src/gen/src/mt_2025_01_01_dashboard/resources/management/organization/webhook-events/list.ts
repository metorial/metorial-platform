import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationWebhookEventsListOutput = {
  object: 'list';
  items: { object: 'event.type'; name: string; description: string }[];
  pagination: {
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    before?: string | undefined;
    after?: string | undefined;
  };
};

export let mapManagementOrganizationWebhookEventsListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationWebhookEventsListOutput>([
    7, 0
  ]);
