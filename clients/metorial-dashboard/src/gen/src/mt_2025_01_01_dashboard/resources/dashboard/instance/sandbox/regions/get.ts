import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxRegionsGetOutput = {
  object: 'sandbox.region';
  id: string;
  name: string;
  area: { id: string; name: string };
  isDefault: boolean;
  availability: 'available' | 'unavailable';
};

export let mapDashboardInstanceSandboxRegionsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxRegionsGetOutput>([
    'is_default'
  ]);
