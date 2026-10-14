import { createMapper } from '@metorial/util-resource-mapper/compact';

export type SandboxSpecsListOutput = {
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

export let mapSandboxSpecsListOutput =
  /* @__PURE__ */ createMapper<SandboxSpecsListOutput>(
    [7, [1, ['memory_mib', 'created_at']]],
    1
  );

export type SandboxSpecsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapSandboxSpecsListQuery =
  /* @__PURE__ */ createMapper<SandboxSpecsListQuery>(0);
