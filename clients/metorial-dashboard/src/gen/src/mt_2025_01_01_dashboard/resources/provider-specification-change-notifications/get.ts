import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ProviderSpecificationChangeNotificationsGetOutput = {
  object: 'provider.specification_change_notification';
  id: string;
  providerId: string;
  providerVersionId: string;
  fromSpecification: {
    object: 'provider.capabilities.specification#preview';
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  toSpecification: {
    object: 'provider.capabilities.specification#preview';
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  fromProviderVersion: {
    object: 'provider.version#preview';
    id: string;
    version: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  toProviderVersion: {
    object: 'provider.version#preview';
    id: string;
    version: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  createdAt: Date;
};

export let mapProviderSpecificationChangeNotificationsGetOutput =
  /* @__PURE__ */ mapObject<ProviderSpecificationChangeNotificationsGetOutput>(
    [
      'provider_id',
      'provider_version_id',
      ['from_specification', 1, 8],
      ['to_specification', 1, 8],
      ['from_provider_version', 1, 8],
      ['to_provider_version', 1, 8],
      'created_at'
    ],
    1
  );
