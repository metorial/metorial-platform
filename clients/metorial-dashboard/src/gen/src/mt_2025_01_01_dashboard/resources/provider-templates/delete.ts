import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ProviderTemplatesDeleteOutput = {
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

export let mapProviderTemplatesDeleteOutput =
  /* @__PURE__ */ mapObject<ProviderTemplatesDeleteOutput>(
    ['integration_id', 'created_at', 'updated_at'],
    1
  );
