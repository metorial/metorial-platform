import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ProviderTemplatesUpdateOutput = {
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

export let mapProviderTemplatesUpdateOutput =
  /* @__PURE__ */ mapObject<ProviderTemplatesUpdateOutput>(
    ['integration_id', 'created_at', 'updated_at'],
    1
  );

export type ProviderTemplatesUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapProviderTemplatesUpdateBody =
  /* @__PURE__ */ createMapper<ProviderTemplatesUpdateBody>(0);
