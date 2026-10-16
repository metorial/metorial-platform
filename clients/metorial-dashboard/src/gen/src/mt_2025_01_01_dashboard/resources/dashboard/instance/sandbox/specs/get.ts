import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxSpecsGetOutput = {
  object: 'sandbox.spec';
  id: string;
  identifier: string;
  memoryGib: number;
  cpus: number;
  available: boolean;
  regions: string[];
  createdAt: Date;
};

export let mapDashboardInstanceSandboxSpecsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxSpecsGetOutput>(
    ['memory_gib', 'created_at'],
    1
  );
