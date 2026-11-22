import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxSpecsListOutput = {
  object: 'list';
  items: {
    object: 'sandbox.spec';
    id: string;
    identifier: string;
    memoryGib: number;
    cpus: number;
    available: boolean;
    regions: string[];
    createdAt: Date;
  }[];
  pagination: {
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    before?: string | undefined;
    after?: string | undefined;
  };
};

export let mapDashboardInstanceSandboxSpecsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxSpecsListOutput>(
    [7, [1, ['memory_gib', 'created_at']]],
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
