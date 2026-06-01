import type { ServerInstanceConfiguration } from '../../prisma/generated/client';

export let serverInstanceConfigurationPresenter = (
  configuration: ServerInstanceConfiguration
) => ({
  object: 'server_instance_configuration' as const,
  id: configuration.id,
  enclave_id: configuration.enclaveId,
  egress_policy: configuration.egressPolicy,
  created_at: configuration.createdAt,
  updated_at: configuration.updatedAt
});
