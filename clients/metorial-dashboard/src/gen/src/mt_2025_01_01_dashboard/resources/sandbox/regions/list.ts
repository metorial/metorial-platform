import { createMapper } from '@metorial/util-resource-mapper/compact';

export type SandboxRegionsListOutput = {
  items: {
    object: 'sandbox.region';
    id: string;
    name: string;
    area: { id: string; name: string };
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSandboxRegionsListOutput =
  /* @__PURE__ */ createMapper<SandboxRegionsListOutput>([7, 0]);

export type SandboxRegionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapSandboxRegionsListQuery =
  /* @__PURE__ */ createMapper<SandboxRegionsListQuery>(0);
