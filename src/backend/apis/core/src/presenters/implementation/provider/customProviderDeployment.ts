import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { customProviderDeploymentLogsType, customProviderDeploymentType } from '../../types';
import { v1ActorPreviewPresenter } from './actorPreview';
import { v1BucketPresenter } from './bucket';
import { v1ScmPushPresenter } from './scmPush';

let commitSchema = v.object({
  object: v.literal('custom_provider.deployment.commit'),
  id: v.string({
    name: 'id',
    description: 'Commit identifier'
  }),
  type: v.enumOf(['create_version', 'merge_version_into_environment', 'rollback_to_version'], {
    name: 'type',
    description: 'Commit type'
  }),
  message: v.nullable(
    v.string({
      name: 'message',
      description: 'Commit message'
    })
  ),
  created_at: v.date({
    name: 'created_at',
    description: 'Timestamp when commit was created'
  })
});

export let v1CustomProviderDeploymentPresenter = Presenter.create(customProviderDeploymentType)
  .presenter(async ({ customProviderDeployment }, opts) => ({
    object: 'custom_provider.deployment' as const,

    id: customProviderDeployment.id,
    status: customProviderDeployment.status,
    trigger: customProviderDeployment.trigger,

    custom_provider_id: customProviderDeployment.customProviderId,
    provider_id: customProviderDeployment.providerId ?? null,
    custom_provider_version_id: customProviderDeployment.customProviderVersionId ?? null,

    commit: customProviderDeployment.commit
      ? {
          object: 'custom_provider.deployment.commit' as const,
          id: customProviderDeployment.commit.id,
          type: customProviderDeployment.commit.type,
          message: customProviderDeployment.commit.message,
          created_at: customProviderDeployment.commit.createdAt
        }
      : null,

    immutable_bucket: customProviderDeployment.immutableBucket
      ? await v1BucketPresenter
          .present({ bucket: customProviderDeployment.immutableBucket }, opts)
          .run()
      : null,

    actor: await v1ActorPreviewPresenter
      .present({ actor: customProviderDeployment.actor }, opts)
      .run(),

    scm_push: customProviderDeployment.scmPush
      ? await v1ScmPushPresenter
          .present({ scmPush: customProviderDeployment.scmPush }, opts)
          .run()
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
      status: v.enumOf(['failed', 'queued', 'deploying', 'succeeded'], {
        name: 'status',
        description: 'Current deployment status'
      }),
      trigger: v.enumOf(['manual', 'system', 'scm'], {
        name: 'trigger',
        description: 'What triggered this deployment'
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
      custom_provider_version_id: v.nullable(
        v.string({
          name: 'custom_provider_version_id',
          description: 'ID of the custom provider version being deployed',
          examples: ['cpv_1aBcDeFgHjKlMnPq']
        })
      ),
      commit: v.nullable(commitSchema),
      immutable_bucket: v.nullable(v1BucketPresenter.schema),
      actor: v1ActorPreviewPresenter.schema,
      scm_push: v.nullable(v1ScmPushPresenter.schema),
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

export let dashboardCustomProviderDeploymentPresenter = Presenter.create(
  customProviderDeploymentType
)
  .presenter(async ({ customProviderDeployment }, opts) => {
    let inner = await v1CustomProviderDeploymentPresenter
      .present({ customProviderDeployment }, opts)
      .run();

    return {
      ...inner,

      immutable_bucket: customProviderDeployment.immutableBucket
        ? await v1BucketPresenter
            .present({ bucket: customProviderDeployment.immutableBucket }, opts)
            .run()
        : null
    };
  })
  .schema(
    v.intersection([
      v1CustomProviderDeploymentPresenter.schema,
      v.object({
        immutable_bucket: v.nullable(v1BucketPresenter.schema)
      })
    ])
  )
  .build();

export let v1CustomProviderDeploymentLogsPresenter = Presenter.create(
  customProviderDeploymentLogsType
)
  .presenter(async ({ logs }) => ({
    object: 'custom_provider.deployment.logs' as const,
    custom_provider_deployment_id: logs.customProviderDeploymentId,

    steps: logs.steps.map(step => ({
      object: 'custom_provider.deployment.logs.step' as const,

      id: step.id,
      name: step.name,
      type: step.type as string,
      status: step.status,

      logs: step.logs.map(log => ({
        object: 'custom_provider.deployment.logs.step.log' as const,
        timestamp: new Date(log.timestamp),
        message: log.message
      })),

      created_at: step.createdAt,
      started_at: step.startedAt,
      ended_at: step.endedAt
    }))
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider.deployment.logs', {
        description: "String representing the object's type"
      }),
      custom_provider_deployment_id: v.string({
        name: 'custom_provider_deployment_id',
        description: 'ID of the deployment these logs belong to'
      }),
      steps: v.array(
        v.object({
          object: v.literal('custom_provider.deployment.logs.step', {
            description: "String representing the deployment log step's type"
          }),
          id: v.string({ description: 'Step identifier' }),
          name: v.string({ description: 'Step name' }),
          type: v.string({
            description: 'Step type',
            examples: ['build', 'deploy']
          }),
          status: v.enumOf(['pending', 'running', 'succeeded', 'failed', 'canceled'], {
            name: 'status',
            description: 'Step status'
          }),
          logs: v.array(
            v.object({
              object: v.literal('custom_provider.deployment.logs.step.log', {
                description: "String representing the deployment log entry's type"
              }),
              timestamp: v.date({ description: 'Log entry timestamp' }),
              message: v.string({ description: 'Log message' })
            })
          ),
          created_at: v.date({ description: 'Timestamp when step was created' }),
          started_at: v.nullable(v.date({ description: 'Timestamp when step started' })),
          ended_at: v.nullable(v.date({ description: 'Timestamp when step ended' }))
        }),
        { name: 'steps', description: 'Deployment steps with logs' }
      )
    })
  )
  .build();
