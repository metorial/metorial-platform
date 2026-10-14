import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxSpecsGetOutput = {
  object: 'sandbox.spec';
  id: string;
  identifier: string;
  memoryMib: number;
  vcpus: number;
  regions: string[];
  createdAt: Date;
};

export let mapManagementInstanceSandboxSpecsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxSpecsGetOutput>(
    ['memory_mib', 'created_at'],
    1
  );
