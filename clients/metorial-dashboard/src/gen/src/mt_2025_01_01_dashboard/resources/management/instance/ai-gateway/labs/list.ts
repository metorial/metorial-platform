import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceAiGatewayLabsListOutput = {
  items: {
    object: 'ai_gateway.lab';
    id: string;
    slug: string;
    name: string;
    description: string | null;
    website: string | null;
    logo: string | null;
    status: 'active' | 'retired';
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceAiGatewayLabsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceAiGatewayLabsListOutput>([
    7, 0
  ]);

export type ManagementInstanceAiGatewayLabsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceAiGatewayLabsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceAiGatewayLabsListQuery>(0);
