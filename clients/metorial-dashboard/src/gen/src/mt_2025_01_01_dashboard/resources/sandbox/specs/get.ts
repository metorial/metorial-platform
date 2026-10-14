import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SandboxSpecsGetOutput = {
  object: 'sandbox.spec';
  id: string;
  identifier: string;
  memoryMib: number;
  vcpus: number;
  regions: string[];
  createdAt: Date;
};

export let mapSandboxSpecsGetOutput =
  /* @__PURE__ */ mapObject<SandboxSpecsGetOutput>(
    ['memory_mib', 'created_at'],
    1
  );
