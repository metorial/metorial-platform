import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceConsumersCreateMemberSessionOutput = {
  accessToken: string;
  catalogItemId?: string | undefined;
};

export let mapManagementInstanceConsumersCreateMemberSessionOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceConsumersCreateMemberSessionOutput>(
    ['access_token', 'catalog_item_id']
  );

export type ManagementInstanceConsumersCreateMemberSessionBody = {
  integrationId?: string | undefined;
};

export let mapManagementInstanceConsumersCreateMemberSessionBody =
  /* @__PURE__ */ mapObject<ManagementInstanceConsumersCreateMemberSessionBody>(
    ['integration_id']
  );
