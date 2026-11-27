import type { SlateInstanceConfiguration } from '@mtsrc/slates-hub-db/client';

export let slateInstanceConfigurationPresenter = (
  configuration: SlateInstanceConfiguration
) => ({
  object: 'slate_instance_configuration' as const,
  id: configuration.id,
  enclave_id: configuration.enclaveId,
  egress_policy: configuration.egressPolicy,
  created_at: configuration.createdAt,
  updated_at: configuration.updatedAt
});
