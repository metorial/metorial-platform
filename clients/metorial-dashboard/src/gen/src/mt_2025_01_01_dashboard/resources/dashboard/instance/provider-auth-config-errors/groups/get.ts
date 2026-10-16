import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderAuthConfigErrorsGroupsGetOutput = {
  object: 'provider.auth_config_error_group';
  id: string;
  type: string;
  code: string;
  message: string;
  providerId: string;
  occurrenceCount: number;
  createdAt: Date;
};

export let mapDashboardInstanceProviderAuthConfigErrorsGroupsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderAuthConfigErrorsGroupsGetOutput>(
    ['provider_id', 'occurrence_count', 'created_at'],
    1
  );
