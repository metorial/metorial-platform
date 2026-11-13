import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumersCreateMemberSessionOutput = {
  accessToken: string;
  catalogItemId?: string | undefined;
};

export let mapConsumersCreateMemberSessionOutput =
  /* @__PURE__ */ mapObject<ConsumersCreateMemberSessionOutput>([
    'access_token',
    'catalog_item_id'
  ]);

export type ConsumersCreateMemberSessionBody = {
  integrationId?: string | undefined;
};

export let mapConsumersCreateMemberSessionBody =
  /* @__PURE__ */ mapObject<ConsumersCreateMemberSessionBody>([
    'integration_id'
  ]);
