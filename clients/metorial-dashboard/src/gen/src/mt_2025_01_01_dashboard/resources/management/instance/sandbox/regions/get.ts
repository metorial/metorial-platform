import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxRegionsGetOutput = {
  object: 'sandbox.region';
  id: string;
  name: string;
  area: { id: string; name: string };
  isDefault: boolean;
  availability: 'available' | 'unavailable';
};

export let mapManagementInstanceSandboxRegionsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxRegionsGetOutput>([
    'is_default'
  ]);
