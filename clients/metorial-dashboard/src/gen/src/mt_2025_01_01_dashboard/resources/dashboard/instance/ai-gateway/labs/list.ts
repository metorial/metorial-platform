import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAiGatewayLabsListOutput = {
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

export let mapDashboardInstanceAiGatewayLabsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceAiGatewayLabsListOutput>([
    7, 0
  ]);

export type DashboardInstanceAiGatewayLabsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceAiGatewayLabsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceAiGatewayLabsListQuery>(0);
