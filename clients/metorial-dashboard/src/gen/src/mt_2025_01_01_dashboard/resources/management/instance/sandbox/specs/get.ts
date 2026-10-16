import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxSpecsGetOutput = {
  object: 'sandbox.spec';
  id: string;
  identifier: string;
  memoryGib: number;
  cpus: number;
  available: boolean;
  regions: string[];
  createdAt: Date;
};

export let mapManagementInstanceSandboxSpecsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxSpecsGetOutput>(
    ['memory_gib', 'created_at'],
    1
  );
