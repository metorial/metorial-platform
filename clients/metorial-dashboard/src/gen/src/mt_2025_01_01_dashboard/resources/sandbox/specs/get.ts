import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SandboxSpecsGetOutput = {
  object: 'sandbox.spec';
  id: string;
  identifier: string;
  memoryGib: number;
  cpus: number;
  available: boolean;
  regions: string[];
  createdAt: Date;
};

export let mapSandboxSpecsGetOutput =
  /* @__PURE__ */ mapObject<SandboxSpecsGetOutput>(
    ['memory_gib', 'created_at'],
    1
  );
