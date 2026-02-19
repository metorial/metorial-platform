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

let normalizeTimestamp = (
  timestamp: Date | string | number | null | undefined
): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp == 'number') return new Date(timestamp);

  let parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

let flattenStepLogs = (steps: any[] | null | undefined) => {
  if (!steps?.length) return [];

  let forgeSourceSeen = new Set<string>();
  let flattened: { type: string; line: string; timestamp: Date | null }[] = [];

  for (let step of steps) {
    let fallbackTimestamp = normalizeTimestamp(step.createdAt ?? null);
    let source = step.source;

    if (source?.provider == 'forge' && source.workflowRunId) {
      let sourceKey = `${source.workflowRunId}:${source.workflowId ?? ''}`;
      if (!forgeSourceSeen.has(sourceKey)) {
        forgeSourceSeen.add(sourceKey);

        flattened.push({
          type: 'info',
          line: `Forge Workflow Run ID: ${source.workflowRunId}`,
          timestamp: fallbackTimestamp
        });
        if (source.workflowId) {
          flattened.push({
            type: 'info',
            line: `Forge Workflow ID: ${source.workflowId}`,
            timestamp: fallbackTimestamp
          });
        }
        if (source.functionDeploymentId) {
          flattened.push({
            type: 'info',
            line: `Function-Bay Deployment ID: ${source.functionDeploymentId}`,
            timestamp: fallbackTimestamp
          });
        }
      }
    }

    for (let log of step.logs ?? []) {
      let line = log.line ?? log.message ?? '';
      if (!line) continue;

      flattened.push({
        type: log.type ?? (step.status == 'failed' ? 'error' : 'info'),
        line,
        timestamp: normalizeTimestamp(log.timestamp) ?? fallbackTimestamp
      });
    }
  }

  return flattened;
};

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

let presentStep = (step: any) => ({
  id: step.id ?? null,
  type: step.type ?? null,
  status: step.status ?? null,
  source: step.source
    ? {
        provider: step.source.provider ?? null,
        workflow_run_id: step.source.workflowRunId ?? null,
        workflow_id: step.source.workflowId ?? null,
        function_deployment_id: step.source.functionDeploymentId ?? null
      }
    : null,
  logs: (step.logs ?? []).map((log: any) => ({
    type: log.type ?? 'info',
    line: log.line ?? log.message ?? '',
    timestamp: normalizeTimestamp(log.timestamp) ?? null
  })),
  created_at: normalizeTimestamp(step.createdAt) ?? null
});

export let v1CustomProviderDeploymentLogsPresenter = Presenter.create(
  customProviderDeploymentLogsType
)
  .presenter(async ({ logs }) => ({
    object: 'custom_provider.deployment.logs' as const,
    logs: (logs.logs ?? flattenStepLogs(logs.steps)).map(log => ({
      type: log.type,
      line: log.line,
      timestamp: log.timestamp ?? null
    })),
    steps: (logs.steps ?? []).map(presentStep)
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
      ),
      steps: v.array(
        v.object({
          id: v.nullable(v.string()),
          type: v.nullable(v.string()),
          status: v.nullable(v.string()),
          source: v.nullable(
            v.object({
              provider: v.nullable(v.string()),
              workflow_run_id: v.nullable(v.string()),
              workflow_id: v.nullable(v.string()),
              function_deployment_id: v.nullable(v.string())
            })
          ),
          logs: v.array(
            v.object({
              type: v.string(),
              line: v.string(),
              timestamp: v.nullable(v.date())
            })
          ),
          created_at: v.nullable(v.date())
        }),
        { name: 'steps', description: 'Deployment steps with individual logs' }
      )
    })
  )
  .build();
