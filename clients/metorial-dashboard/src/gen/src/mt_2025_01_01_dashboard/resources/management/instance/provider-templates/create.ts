import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderTemplatesCreateOutput = {
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

export let mapManagementInstanceProviderTemplatesCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderTemplatesCreateOutput>(
    ['integration_id', 'created_at', 'updated_at'],
    1
  );

export type ManagementInstanceProviderTemplatesCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  integrationId: string;
};

export let mapManagementInstanceProviderTemplatesCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderTemplatesCreateBody>([
    'integration_id'
  ]);
