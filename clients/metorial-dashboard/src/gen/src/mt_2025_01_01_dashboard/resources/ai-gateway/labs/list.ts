import { createMapper } from '@metorial/util-resource-mapper/compact';

export type AiGatewayLabsListOutput = {
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

export let mapAiGatewayLabsListOutput =
  /* @__PURE__ */ createMapper<AiGatewayLabsListOutput>([7, 0]);

export type AiGatewayLabsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapAiGatewayLabsListQuery =
  /* @__PURE__ */ createMapper<AiGatewayLabsListQuery>(0);
