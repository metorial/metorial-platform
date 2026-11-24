import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxRegionsListOutput = {
  items: {
    object: 'sandbox.region';
    id: string;
    name: string;
    area: { id: string; name: string };
    isDefault: boolean;
    availability: 'available' | 'unavailable';
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSandboxRegionsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxRegionsListOutput>([
    7,
    [1, ['is_default']]
  ]);

export type DashboardInstanceSandboxRegionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceSandboxRegionsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxRegionsListQuery>(0);
