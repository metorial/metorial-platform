import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { customProviderCommitType } from '../../types';
import { v1CustomProviderEnvironmentPresenter } from './customProviderEnvironment';
import { v1CustomProviderVersionPresenter } from './customProviderVersion';

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

let errorSchema = v.object({
  code: v.string({
    name: 'code',
    description: 'Error code',
    examples: ['deployment_failed']
  }),
  message: v.string({
    name: 'message',
    description: 'Error message',
    examples: ['Deployment failed due to timeout']
  })
});

export let v1CustomProviderCommitPresenter = Presenter.create(customProviderCommitType)
  .presenter(async ({ customProviderCommit }, opts) => ({
    object: 'custom_provider.commit' as const,
    id: customProviderCommit.id,
    status: customProviderCommit.status,
    trigger: customProviderCommit.trigger,
    error: customProviderCommit.error
      ? {
          code: customProviderCommit.error.code,
          message: customProviderCommit.error.message
        }
      : null,
    custom_provider_id: customProviderCommit.customProviderId,
    provider_id: customProviderCommit.providerId ?? null,
    custom_provider_deployment_id: customProviderCommit.customProviderDeploymentId ?? null,
    to_environment: customProviderCommit.toEnvironment
      ? await v1CustomProviderEnvironmentPresenter
          .present({ customProviderEnvironment: customProviderCommit.toEnvironment }, opts)
          .run()
      : null,
    from_environment: customProviderCommit.fromEnvironment
      ? await v1CustomProviderEnvironmentPresenter
          .present({ customProviderEnvironment: customProviderCommit.fromEnvironment }, opts)
          .run()
      : null,
    target_custom_provider_version: customProviderCommit.targetCustomProviderVersion
      ? await v1CustomProviderVersionPresenter
          .present(
            { customProviderVersion: customProviderCommit.targetCustomProviderVersion },
            opts
          )
          .run()
      : null,
    previous_custom_provider_version: customProviderCommit.previousCustomProviderVersion
      ? await v1CustomProviderVersionPresenter
          .present(
            { customProviderVersion: customProviderCommit.previousCustomProviderVersion },
            opts
          )
          .run()
      : null,
    actor: customProviderCommit.actor
      ? {
          id: customProviderCommit.actor.id,
          name: customProviderCommit.actor.name,
          type: customProviderCommit.actor.type,
          organization_actor_id: customProviderCommit.actor.organizationActorId
        }
      : null,
    created_at: customProviderCommit.createdAt,
    applied_at: customProviderCommit.appliedAt ?? null
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider.commit', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique custom provider commit identifier',
        examples: ['cpcm_1aBcDeFgHjKlMnPq']
      }),
      status: v.nullable(
        v.string({
          name: 'status',
          description: 'Current commit status',
          examples: ['pending', 'in_progress', 'completed', 'failed']
        })
      ),
      trigger: v.nullable(
        v.string({
          name: 'trigger',
          description: 'What triggered this commit',
          examples: ['manual', 'automatic']
        })
      ),
      error: v.nullable(errorSchema),
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
      custom_provider_deployment_id: v.nullable(
        v.string({
          name: 'custom_provider_deployment_id',
          description: 'ID of the associated deployment',
          examples: ['cpd_1aBcDeFgHjKlMnPq']
        })
      ),
      to_environment: v.nullable(v1CustomProviderEnvironmentPresenter.schema),
      from_environment: v.nullable(v1CustomProviderEnvironmentPresenter.schema),
      target_custom_provider_version: v.nullable(v1CustomProviderVersionPresenter.schema),
      previous_custom_provider_version: v.nullable(v1CustomProviderVersionPresenter.schema),
      actor: v.nullable(actorSchema),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      applied_at: v.nullable(
        v.date({
          name: 'applied_at',
          description: 'Timestamp when the commit was applied',
          examples: [new Date('2025-09-15T10:35:00Z')]
        })
      )
    })
  )
  .build();
