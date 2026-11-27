import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import {
  customProviderDeploymentLogsType,
  customProviderDeploymentType
} from '../../../types';
import { v1ScmPushPresenter } from '../../scm';
import { v1ActorPreviewPresenter } from './actorPreview';
import { v1BucketPresenter } from './bucket';

let commitSchema = v.object(
  {
    object: v.literal('custom_provider.deployment.commit', {
      description: 'String representing the object’s type.'
    }),
    id: v.string({
      name: 'id',
      description: 'Unique ID.'
    }),
    type: v.enumOf(
      ['create_version', 'merge_version_into_environment', 'rollback_to_version'],
      {
        name: 'type',
        description:
          'What the commit did: created a version, merged one into an environment, or rolled one back.'
      }
    ),
    message: v.nullable(
      v.string({
        name: 'message',
        description: 'Message of the commit. `null` when the commit has no message.'
      })
    ),
    created_at: v.date({
      name: 'created_at',
      description: 'Creation time.'
    })
  },
  {
    description:
      'Commit that triggered this deployment. `null` for deployments without a commit.'
  }
);

export let v1CustomProviderDeploymentPresenter = Presenter.create(customProviderDeploymentType)
  .presenter(async ({ customProviderDeployment }, opts) => ({
    object: 'custom_provider.deployment' as const,

    id: customProviderDeployment.id,
    status: customProviderDeployment.status,
    trigger: customProviderDeployment.trigger,

    custom_provider_id: customProviderDeployment.customProvider.id,
    provider_id: customProviderDeployment.customProvider.provider?.id ?? null,
    custom_provider_version_id: customProviderDeployment.customProviderVersion?.id ?? null,

    commit: customProviderDeployment.commit
      ? {
          object: 'custom_provider.deployment.commit' as const,
          id: customProviderDeployment.commit.id,
          type: customProviderDeployment.commit.type,
          message: customProviderDeployment.commit.message,
          created_at: customProviderDeployment.commit.createdAt
        }
      : null,

    immutable_bucket: customProviderDeployment.immutableCodeBucket
      ? await v1BucketPresenter
          .present({ bucket: customProviderDeployment.immutableCodeBucket }, opts)
          .run()
      : null,

    actor: await v1ActorPreviewPresenter
      .present({ actor: customProviderDeployment.creatorActor }, opts)
      .run(),

    scm_push: customProviderDeployment.scmRepoPush
      ? await v1ScmPushPresenter
          .present({ scmPush: customProviderDeployment.scmRepoPush }, opts)
          .run()
      : null,

    created_at: customProviderDeployment.createdAt,
    updated_at: customProviderDeployment.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider.deployment', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['cpd_1aBcDeFgHjKlMnPq']
      }),
      status: v.enumOf(['failed', 'queued', 'deploying', 'succeeded'], {
        name: 'status',
        description: 'Build and rollout status.'
      }),
      trigger: v.enumOf(['manual', 'system', 'scm'], {
        name: 'trigger',
        description:
          'How the deployment was triggered: manually, by the system, or by an SCM push.'
      }),
      custom_provider_id: v.string({
        name: 'custom_provider_id',
        description: 'Custom provider being deployed.',
        examples: ['cpr_1aBcDeFgHjKlMnPq']
      }),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'Associated provider, by ID. `null` when there is none.',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      custom_provider_version_id: v.nullable(
        v.string({
          name: 'custom_provider_version_id',
          description: 'Version being deployed, by ID.',
          examples: ['cpv_1aBcDeFgHjKlMnPq']
        })
      ),
      commit: v.nullable(commitSchema),
      immutable_bucket: v.nullable(v1BucketPresenter.schema, {
        description: 'Immutable copy of the deployed code.'
      }),
      actor: v1ActorPreviewPresenter.schema,
      scm_push: v.nullable(v1ScmPushPresenter.schema, {
        description:
          'SCM push that triggered the deployment. `null` unless `trigger` is `scm`.'
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
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

      immutable_bucket: customProviderDeployment.immutableCodeBucket
        ? await v1BucketPresenter
            .present({ bucket: customProviderDeployment.immutableCodeBucket }, opts)
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

    steps: logs.steps.map((step: (typeof logs.steps)[number]) => ({
      object: 'custom_provider.deployment.logs.step' as const,

      id: step.id,
      name: step.name,
      type: step.type as string,
      status: step.status,

      logs: step.logs.map((log: (typeof step.logs)[number]) => ({
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
        description: 'String representing the object’s type.'
      }),
      custom_provider_deployment_id: v.string({
        name: 'custom_provider_deployment_id',
        description: 'Deployment these logs belong to.'
      }),
      steps: v.array(
        v.object(
          {
            object: v.literal('custom_provider.deployment.logs.step', {
              description: 'String representing the object’s type.'
            }),
            id: v.string({ description: 'Unique ID.' }),
            name: v.string({ description: 'Name of the step.' }),
            type: v.string({
              description: 'What kind of work the step does.',
              examples: ['build', 'deploy']
            }),
            status: v.enumOf(['pending', 'running', 'succeeded', 'failed', 'canceled'], {
              name: 'status',
              description: 'Step execution status.'
            }),
            logs: v.array(
              v.object({
                object: v.literal('custom_provider.deployment.logs.step.log', {
                  description: 'String representing the object’s type.'
                }),
                timestamp: v.date({ description: 'When the log line was emitted.' }),
                message: v.string({ description: 'Log line text.' })
              }),
              { description: 'Log lines for this step.' }
            ),
            created_at: v.date({ description: 'Creation time.' }),
            started_at: v.nullable(
              v.date({
                description: 'When the step started. `null` while `status` is `pending`.'
              })
            ),
            ended_at: v.nullable(
              v.date({ description: 'When the step ended. `null` until the step finishes.' })
            )
          },
          { description: 'Step of the deployment.' }
        ),
        { name: 'steps', description: 'Steps of the deployment, in order.' }
      )
    })
  )
  .build();
