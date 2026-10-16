import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderTemplatesUpdateOutput = {
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

export let mapDashboardInstanceProviderTemplatesUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderTemplatesUpdateOutput>(
    ['integration_id', 'created_at', 'updated_at'],
    1
  );

export type DashboardInstanceProviderTemplatesUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapDashboardInstanceProviderTemplatesUpdateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderTemplatesUpdateBody>(0);
