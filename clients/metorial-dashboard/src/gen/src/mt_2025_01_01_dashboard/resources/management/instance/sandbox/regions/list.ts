import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxRegionsListOutput = {
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

export let mapManagementInstanceSandboxRegionsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxRegionsListOutput>([
    7,
    [1, ['is_default']]
  ]);

export type ManagementInstanceSandboxRegionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceSandboxRegionsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxRegionsListQuery>(0);
