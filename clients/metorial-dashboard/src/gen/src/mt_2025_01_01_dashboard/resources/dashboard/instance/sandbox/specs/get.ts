import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxSpecsGetOutput = {
  object: 'sandbox.spec';
  id: string;
  identifier: string;
  memoryMib: number;
  vcpus: number;
  regions: string[];
  createdAt: Date;
};

export let mapDashboardInstanceSandboxSpecsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxSpecsGetOutput>(
    ['memory_mib', 'created_at'],
    1
  );
