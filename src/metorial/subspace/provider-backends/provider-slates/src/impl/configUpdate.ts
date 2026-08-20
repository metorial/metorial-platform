import type { ProviderConfigPatch } from '@metorial-subspace/provider-utils';

export let buildSlateProviderConfigUpdateRequest = (d: {
  tenantId: string;
  slateInstanceId: string;
  patch: ProviderConfigPatch;
  expectedGeneration?: number;
}) => ({
  tenantId: d.tenantId,
  slateInstanceId: d.slateInstanceId,
  patch: d.patch,
  expectedGeneration: d.expectedGeneration
});
