import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAiGatewayProvidersListOutput = {
  items: {
    object: 'ai_gateway.provider';
    id: string;
    slug: string;
    name: string;
    kind:
      | 'metorial'
      | 'first_party'
      | 'cloud'
      | 'inference'
      | 'aggregator'
      | 'subscription'
      | 'decision';
    website: string | null;
    docs: string | null;
    logo: string | null;
    status: 'active' | 'retired';
    supported: boolean;
    features: { zdr: boolean };
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceAiGatewayProvidersListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceAiGatewayProvidersListOutput>([
    7, 0
  ]);

export type DashboardInstanceAiGatewayProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceAiGatewayProvidersListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceAiGatewayProvidersListQuery>(0);
