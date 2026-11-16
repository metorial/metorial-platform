import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceConsumersCreateMemberSessionOutput = {
  accessToken: string;
  catalogItemId?: string | undefined;
};

export let mapDashboardInstanceConsumersCreateMemberSessionOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceConsumersCreateMemberSessionOutput>(
    ['access_token', 'catalog_item_id']
  );

export type DashboardInstanceConsumersCreateMemberSessionBody = {
  integrationId?: string | undefined;
};

export let mapDashboardInstanceConsumersCreateMemberSessionBody =
  /* @__PURE__ */ mapObject<DashboardInstanceConsumersCreateMemberSessionBody>([
    'integration_id'
  ]);
