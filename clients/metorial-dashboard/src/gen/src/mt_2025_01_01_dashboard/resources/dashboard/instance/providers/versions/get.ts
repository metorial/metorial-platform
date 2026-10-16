import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProvidersVersionsGetOutput = {
  object: 'provider.version';
  id: string;
  version: string;
  providerId: string;
  isCurrent: boolean;
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  specificationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProvidersVersionsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProvidersVersionsGetOutput>(
    [
      'provider_id',
      'is_current',
      'specification_id',
      'created_at',
      'updated_at'
    ],
    1
  );
