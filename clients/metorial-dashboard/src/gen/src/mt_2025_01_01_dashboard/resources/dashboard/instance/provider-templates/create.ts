import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderTemplatesCreateOutput = {
  object: 'provider.template';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  integrationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderTemplatesCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderTemplatesCreateOutput>(
    ['integration_id', 'created_at', 'updated_at'],
    1
  );

export type DashboardInstanceProviderTemplatesCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  integrationId: string;
};

export let mapDashboardInstanceProviderTemplatesCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderTemplatesCreateBody>([
    'integration_id'
  ]);
