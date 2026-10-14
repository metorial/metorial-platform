import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderTemplatesGetOutput = {
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

export let mapManagementInstanceProviderTemplatesGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderTemplatesGetOutput>(
    ['integration_id', 'created_at', 'updated_at'],
    1
  );
