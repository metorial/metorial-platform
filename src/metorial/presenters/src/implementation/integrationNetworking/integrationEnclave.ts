import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { integrationEnclaveType } from '../../types';

let enclaveEnvironmentPreviewSchema = v.object({
  object: v.literal('integration.enclave.environment#preview'),
  id: v.string(),
  name: v.string(),
  type: v.enumOf(['metorial', 'outpost']),
  created_at: v.date()
});

export let v1IntegrationEnclavePresenter = Presenter.create(integrationEnclaveType)
  .presenter(async ({ enclave }) => ({
    object: 'integration.enclave' as const,
    id: enclave.id,
    slug: enclave.slug,
    name: enclave.name,
    description: enclave.description,
    internet_gateway_id: enclave.internetGateway.id,
    provider_deployment_id: enclave.providerDeployment.id,
    enclave_environment: {
      object: 'integration.enclave.environment#preview' as const,
      id: enclave.enclaveEnvironment.id,
      name: enclave.enclaveEnvironment.name,
      type: enclave.enclaveEnvironment.type,
      created_at: enclave.enclaveEnvironment.createdAt
    },
    created_at: enclave.createdAt,
    last_used_at: enclave.lastUsedAt ?? null
  }))
  .schema(
    v.object({
      object: v.literal('integration.enclave'),
      id: v.string(),
      slug: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      internet_gateway_id: v.string(),
      provider_deployment_id: v.string(),
      enclave_environment: enclaveEnvironmentPreviewSchema,
      created_at: v.date(),
      last_used_at: v.nullable(v.date())
    })
  )
  .build();
