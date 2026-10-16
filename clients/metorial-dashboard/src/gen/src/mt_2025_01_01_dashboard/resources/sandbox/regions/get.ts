import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SandboxRegionsGetOutput = {
  object: 'sandbox.region';
  id: string;
  name: string;
  area: { id: string; name: string };
  isDefault: boolean;
  availability: 'available' | 'unavailable';
};

export let mapSandboxRegionsGetOutput =
  /* @__PURE__ */ mapObject<SandboxRegionsGetOutput>(['is_default']);
