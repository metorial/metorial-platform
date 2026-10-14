import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxSpecsListOutput = {
  items: {
    object: 'sandbox.spec';
    id: string;
    identifier: string;
    memoryMib: number;
    vcpus: number;
    regions: string[];
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSandboxSpecsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxSpecsListOutput>(
    [7, [1, ['memory_mib', 'created_at']]],
    1
  );

export type DashboardInstanceSandboxSpecsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceSandboxSpecsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxSpecsListQuery>(0);
