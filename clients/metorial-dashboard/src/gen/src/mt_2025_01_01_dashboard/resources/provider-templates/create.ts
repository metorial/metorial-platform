import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ProviderTemplatesCreateOutput = {
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

export let mapProviderTemplatesCreateOutput =
  /* @__PURE__ */ mapObject<ProviderTemplatesCreateOutput>(
    ['integration_id', 'created_at', 'updated_at'],
    1
  );

export type ProviderTemplatesCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  integrationId: string;
};

export let mapProviderTemplatesCreateBody =
  /* @__PURE__ */ mapObject<ProviderTemplatesCreateBody>(['integration_id']);
