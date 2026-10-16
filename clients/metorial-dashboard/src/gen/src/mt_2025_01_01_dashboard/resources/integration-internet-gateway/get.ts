import { mapObject } from '@metorial/util-resource-mapper/compact';

export type IntegrationInternetGatewayGetOutput = {
  object: 'integration.internet_gateway';
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  publicIps: {
    object: 'integration.internet_gateway.public_ip';
    id: string;
    ip: string;
    region: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
};

export let mapIntegrationInternetGatewayGetOutput =
  /* @__PURE__ */ mapObject<IntegrationInternetGatewayGetOutput>(
    ['created_at', 'updated_at', ['public_ips', 1, [2, 8]]],
    1
  );
