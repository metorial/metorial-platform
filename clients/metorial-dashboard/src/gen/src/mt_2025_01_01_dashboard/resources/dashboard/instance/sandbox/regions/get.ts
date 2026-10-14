import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxRegionsGetOutput = {
  object: 'sandbox.region';
  id: string;
  name: string;
  area: { id: string; name: string };
};

export let mapDashboardInstanceSandboxRegionsGetOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxRegionsGetOutput>(0);
