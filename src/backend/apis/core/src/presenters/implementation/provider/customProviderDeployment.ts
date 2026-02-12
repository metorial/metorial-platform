import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { customProviderDeploymentType, customProviderDeploymentLogsType } from '../../types';

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

let commitSchema = v.object({
  id: v.string({
    name: 'id',
    description: 'Commit identifier',
    examples: ['cpcm_1aBcDeFgHjKlMnPq']
  }),
  type: v.nullable(
    v.string({
      name: 'type',
      description: 'Commit type',
      examples: ['merge', 'rollback']
    })
  ),
  message: v.nullable(
    v.string({
      name: 'message',
      description: 'Commit message',
      examples: ['Deploy new version']
    })
  ),
  created_at: v.date({
    name: 'created_at',
    description: 'Timestamp when commit was created',
    examples: [new Date('2025-09-15T10:30:00Z')]
  })
});

export let v1CustomProviderDeploymentPresenter = Presenter.create(customProviderDeploymentType)
  .presenter(async ({ customProviderDeployment }) => ({
    object: 'custom_provider.deployment' as const,
    id: customProviderDeployment.id,
    status: customProviderDeployment.status,
    trigger: customProviderDeployment.trigger,
    custom_provider_id: customProviderDeployment.customProviderId,
    provider_id: customProviderDeployment.providerId ?? null,
    custom_provider_version_id: customProviderDeployment.customProviderVersionId ?? null,
    commit: customProviderDeployment.commit
      ? {
          id: customProviderDeployment.commit.id,
          type: customProviderDeployment.commit.type,
          message: customProviderDeployment.commit.message,
          created_at: customProviderDeployment.commit.createdAt
        }
      : null,
    actor: customProviderDeployment.actor
      ? {
          id: customProviderDeployment.actor.id,
          name: customProviderDeployment.actor.name,
          type: customProviderDeployment.actor.type,
          organization_actor_id: customProviderDeployment.actor.organizationActorId
        }
      : null,
    created_at: customProviderDeployment.createdAt,
    updated_at: customProviderDeployment.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider.deployment', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique custom provider deployment identifier',
        examples: ['cpd_1aBcDeFgHjKlMnPq']
      }),
      status: v.nullable(
        v.string({
          name: 'status',
          description: 'Current deployment status',
          examples: ['queued', 'deploying', 'succeeded', 'failed']
        })
      ),
      trigger: v.nullable(
        v.string({
          name: 'trigger',
          description: 'What triggered this deployment',
          examples: ['manual', 'commit']
        })
      ),
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
      custom_provider_version_id: v.nullable(
        v.string({
          name: 'custom_provider_version_id',
          description: 'ID of the custom provider version being deployed',
          examples: ['cpv_1aBcDeFgHjKlMnPq']
        })
      ),
      commit: v.nullable(commitSchema),
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

export let v1CustomProviderDeploymentLogsPresenter = Presenter.create(
  customProviderDeploymentLogsType
)
  .presenter(async ({ logs }) => ({
    object: 'custom_provider.deployment.logs' as const,
    logs: logs.logs.map(log => ({
      type: log.type,
      line: log.line,
      timestamp: log.timestamp ?? null
    }))
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider.deployment.logs', {
        description: "String representing the object's type"
      }),
      logs: v.array(
        v.object({
          type: v.string({
            name: 'type',
            description: 'Log type',
            examples: ['stdout', 'stderr']
          }),
          line: v.string({
            name: 'line',
            description: 'Log line content',
            examples: ['Building image...']
          }),
          timestamp: v.nullable(
            v.date({
              name: 'timestamp',
              description: 'Timestamp of the log entry',
              examples: [new Date('2025-09-15T10:30:00Z')]
            })
          )
        }),
        {
          name: 'logs',
          description: 'Array of log entries'
        }
      )
    })
  )
  .build();
