import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceIntegrationInternetGatewayGetOutput = {
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

export let mapManagementInstanceIntegrationInternetGatewayGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceIntegrationInternetGatewayGetOutput>(
    ['created_at', 'updated_at', ['public_ips', 1, [2, 8]]],
    1
  );
