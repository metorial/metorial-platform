import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceAiGatewayProvidersListOutput = {
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

export let mapManagementInstanceAiGatewayProvidersListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceAiGatewayProvidersListOutput>([
    7, 0
  ]);

export type ManagementInstanceAiGatewayProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceAiGatewayProvidersListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceAiGatewayProvidersListQuery>(
    0
  );
