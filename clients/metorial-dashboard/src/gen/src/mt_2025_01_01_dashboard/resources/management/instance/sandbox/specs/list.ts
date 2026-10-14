import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxSpecsListOutput = {
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

export let mapManagementInstanceSandboxSpecsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxSpecsListOutput>(
    [7, [1, ['memory_mib', 'created_at']]],
    1
  );

export type ManagementInstanceSandboxSpecsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceSandboxSpecsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxSpecsListQuery>(0);
