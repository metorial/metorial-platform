import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderTemplatesUpdateOutput = {
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

export let mapManagementInstanceProviderTemplatesUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderTemplatesUpdateOutput>(
    ['integration_id', 'created_at', 'updated_at'],
    1
  );

export type ManagementInstanceProviderTemplatesUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapManagementInstanceProviderTemplatesUpdateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderTemplatesUpdateBody>(
    0
  );
