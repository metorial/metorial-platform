import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { integrationEnclaveType } from '../../types';

let enclaveEnvironmentPreviewSchema = v.object(
  {
    object: v.literal('integration.enclave.environment#preview', {
      description: 'String representing the object’s type.'
    }),
    id: v.string({
      description: 'Unique ID.'
    }),
    name: v.string({
      description: 'Display name.'
    }),
    type: v.enumOf(['metorial', 'outpost'], {
      description:
        '`metorial` for Metorial-hosted environments. `outpost` for environments in your own infrastructure.'
    }),
    created_at: v.date({
      description: 'Creation time.'
    })
  },
  {
    description: 'Environment the enclave runs in.'
  }
);

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
      object: v.literal('integration.enclave', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.'
      }),
      slug: v.string({
        description: 'URL-safe name, unique within the instance.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      internet_gateway_id: v.string({
        description: 'Internet gateway the enclave uses.'
      }),
      provider_deployment_id: v.string({
        description: 'Provider deployment running in the enclave.'
      }),
      enclave_environment: enclaveEnvironmentPreviewSchema,
      created_at: v.date({
        description: 'Creation time.'
      }),
      last_used_at: v.nullable(
        v.date({
          description: 'When the enclave was last used. `null` when never used.'
        })
      )
    })
  )
  .build();
