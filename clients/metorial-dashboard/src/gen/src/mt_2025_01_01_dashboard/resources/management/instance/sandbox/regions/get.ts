import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxRegionsGetOutput = {
  object: 'sandbox.region';
  id: string;
  name: string;
  area: { id: string; name: string };
};

export let mapManagementInstanceSandboxRegionsGetOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxRegionsGetOutput>(0);
