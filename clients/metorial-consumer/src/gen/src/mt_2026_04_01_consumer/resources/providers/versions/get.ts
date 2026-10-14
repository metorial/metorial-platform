import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ProvidersVersionsGetOutput = {
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

export let mapProvidersVersionsGetOutput =
  /* @__PURE__ */ mapObject<ProvidersVersionsGetOutput>(
    [
      'provider_id',
      'is_current',
      'specification_id',
      'created_at',
      'updated_at'
    ],
    1
  );
