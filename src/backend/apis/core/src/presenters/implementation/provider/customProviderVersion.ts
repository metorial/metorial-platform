import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { customProviderVersionType } from '../../types';
import { v1CustomProviderDeploymentPresenter } from './customProviderDeployment';
import { v1CustomProviderEnvironmentPresenter } from './customProviderEnvironment';

let actorSchema = v.object({
  id: v.string({
    name: 'id',
    description: 'Actor identifier',
    examples: ['act_1aBcDeFgHjKlMnPq']
  }),
  name: v.nullable(
    v.string({
      name: 'name',
      description: 'Actor display name',
      examples: ['John Doe']
    })
  ),
  type: v.nullable(
    v.string({
      name: 'type',
      description: 'Actor type',
      examples: ['external', 'system']
    })
  ),
  organization_actor_id: v.nullable(
    v.string({
      name: 'organization_actor_id',
      description: 'Organization actor ID if linked',
      examples: ['orgact_1aBcDeFgHjKlMnPq']
    })
  )
});

let environmentNestedSchema = v.object({
  object: v.literal('custom_provider.environment', {
    description: "String representing the object's type"
  }),
  id: v.string({
    name: 'id',
    description: 'Environment version reference identifier',
    examples: ['cpenv_1aBcDeFgHjKlMnPq']
  }),
  is_current_version_for_environment: v.nullable(
    v.boolean({
      name: 'is_current_version_for_environment',
      description: 'Whether this version is the current one for the environment'
    })
  ),
  environment: v1CustomProviderEnvironmentPresenter.schema
});

export let v1CustomProviderVersionPresenter = Presenter.create(customProviderVersionType)
  .presenter(async ({ customProviderVersion }, opts) => ({
    object: 'custom_provider.version' as const,
    id: customProviderVersion.id,
    status: customProviderVersion.status,
    index: customProviderVersion.index ?? null,
    identifier: customProviderVersion.identifier ?? null,
    deployment: customProviderVersion.deployment
      ? await v1CustomProviderDeploymentPresenter
          .present({ customProviderDeployment: customProviderVersion.deployment }, opts)
          .run()
      : null,
    environments: customProviderVersion.environments
      ? await Promise.all(
          customProviderVersion.environments.map(async env => ({
            object: 'custom_provider.environment' as const,
            id: env.id,
            is_current_version_for_environment: env.isCurrentVersionForEnvironment ?? null,
            environment: await v1CustomProviderEnvironmentPresenter
              .present({ customProviderEnvironment: env.environment }, opts)
              .run()
          }))
        )
      : [],
    custom_provider_id: customProviderVersion.customProviderId,
    provider_id: customProviderVersion.providerId ?? null,
    actor: customProviderVersion.actor
      ? {
          id: customProviderVersion.actor.id,
          name: customProviderVersion.actor.name,
          type: customProviderVersion.actor.type,
          organization_actor_id: customProviderVersion.actor.organizationActorId
        }
      : null,
    created_at: customProviderVersion.createdAt,
    updated_at: customProviderVersion.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider.version', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique custom provider version identifier',
        examples: ['cpv_1aBcDeFgHjKlMnPq']
      }),
      status: v.nullable(
        v.string({
          name: 'status',
          description: 'Current version status',
          examples: ['queued', 'deploying', 'deployment_succeeded', 'deployment_failed']
        })
      ),
      index: v.nullable(
        v.number({
          name: 'index',
          description: 'Version index number',
          examples: [1, 2, 3]
        })
      ),
      identifier: v.nullable(
        v.string({
          name: 'identifier',
          description: 'Version identifier',
          examples: ['v1.0.0']
        })
      ),
      deployment: v.nullable(v1CustomProviderDeploymentPresenter.schema),
      environments: v.array(environmentNestedSchema, {
        name: 'environments',
        description: 'Environments this version is deployed to'
      }),
      custom_provider_id: v.string({
        name: 'custom_provider_id',
        description: 'ID of the parent custom provider',
        examples: ['cpr_1aBcDeFgHjKlMnPq']
      }),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'ID of the associated provider',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      actor: v.nullable(actorSchema),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
