import { createMapper } from '@metorial/util-resource-mapper/compact';

export type SandboxRegionsGetOutput = {
  object: 'sandbox.region';
  id: string;
  name: string;
  area: { id: string; name: string };
};

export let mapSandboxRegionsGetOutput =
  /* @__PURE__ */ createMapper<SandboxRegionsGetOutput>(0);
