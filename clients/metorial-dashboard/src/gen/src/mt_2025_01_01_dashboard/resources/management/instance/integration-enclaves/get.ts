import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceIntegrationEnclavesGetOutput = {
  object: 'integration.enclave';
  id: string;
  slug: string;
  name: string;
  description: string | null;
  internetGatewayId: string;
  providerDeploymentId: string;
  enclaveEnvironment: {
    object: 'integration.enclave.environment#preview';
    id: string;
    name: string;
    type: 'metorial' | 'outpost';
    createdAt: Date;
  };
  createdAt: Date;
  lastUsedAt: Date | null;
};

export let mapManagementInstanceIntegrationEnclavesGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceIntegrationEnclavesGetOutput>(
    [
      'internet_gateway_id',
      'provider_deployment_id',
      ['enclave_environment', 1, [1, ['created_at']]],
      'created_at',
      'last_used_at'
    ],
    1
  );
