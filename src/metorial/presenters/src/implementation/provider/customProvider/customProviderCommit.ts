import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { customProviderCommitType } from '../../../types';
import { v1ScmPushPresenter } from '../../scm';
import { v1ActorPreviewPresenter } from './actorPreview';
import { v1CustomProviderEnvironmentPresenter } from './customProviderEnvironment';
import { v1CustomProviderVersionPresenter } from './customProviderVersion';

export let v1CustomProviderCommitPresenter = Presenter.create(customProviderCommitType)
  .presenter(async ({ customProviderCommit }, opts) => ({
    object: 'custom_provider.commit' as const,

    id: customProviderCommit.id,
    status: customProviderCommit.status,
    trigger: customProviderCommit.trigger,
    // type: customProviderCommit.type,

    error: customProviderCommit.errorCode
      ? {
          code: customProviderCommit.errorCode,
          message: customProviderCommit.errorMessage ?? customProviderCommit.errorCode
        }
      : null,

    custom_provider_id: customProviderCommit.customProvider.id,
    provider_id: customProviderCommit.customProvider.provider?.id ?? null,
    custom_provider_deployment_id: customProviderCommit.customProviderDeployment?.id ?? null,

    to_environment: await v1CustomProviderEnvironmentPresenter
      .present(
        {
          customProviderEnvironment: {
            ...customProviderCommit.toEnvironment,
            customProvider: customProviderCommit.customProvider
          }
        },
        opts
      )
      .run(),
    from_environment: customProviderCommit.fromEnvironment
      ? await v1CustomProviderEnvironmentPresenter
          .present(
            {
              customProviderEnvironment: {
                ...customProviderCommit.fromEnvironment,
                customProvider: customProviderCommit.customProvider
              }
            },
            opts
          )
          .run()
      : null,

    target_custom_provider_version: await v1CustomProviderVersionPresenter
      .present(
        {
          customProviderVersion: {
            ...customProviderCommit.targetCustomProviderVersion,
            customProvider: customProviderCommit.customProvider
          }
        },
        opts
      )
      .run(),
    previous_custom_provider_version: customProviderCommit.toEnvironmentVersionBefore
      ? await v1CustomProviderVersionPresenter
          .present(
            {
              customProviderVersion: {
                ...customProviderCommit.toEnvironmentVersionBefore,
                customProvider: customProviderCommit.customProvider
              }
            },
            opts
          )
          .run()
      : null,

    actor: await v1ActorPreviewPresenter
      .present({ actor: customProviderCommit.creatorActor }, opts)
      .run(),

    scm_push: customProviderCommit.scmRepoPush
      ? await v1ScmPushPresenter
          .present({ scmPush: customProviderCommit.scmRepoPush }, opts)
          .run()
      : null,

    created_at: customProviderCommit.createdAt,
    applied_at: customProviderCommit.appliedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider.commit', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['cpcm_1aBcDeFgHjKlMnPq']
      }),
      status: v.enumOf(['pending', 'applied', 'failed'], {
        name: 'status',
        description: '`applied` once the version promotion takes effect.'
      }),
      trigger: v.enumOf(['manual', 'system', 'scm'], {
        name: 'trigger',
        description: 'How the commit was created: manually, by the system, or by an SCM push.'
      }),
      // type: v.enumOf(["create_version" , "merge_version_into_environment" , "rollback_to_version"], {
      //   name: 'type',
      //   description: 'The type of commit action',
      // }),
      error: v.nullable(
        v.object(
          {
            code: v.string({
              name: 'code',
              description: 'Machine-readable error code.',
              examples: ['deployment_failed']
            }),
            message: v.string({
              name: 'message',
              description: 'Human-readable error message.',
              examples: ['Deployment failed due to timeout']
            })
          },
          { description: 'Failure details. `null` when the commit did not fail.' }
        )
      ),
      custom_provider_id: v.string({
        name: 'custom_provider_id',
        description: 'Custom provider this commit belongs to.',
        examples: ['cpr_1aBcDeFgHjKlMnPq']
      }),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'Associated provider, by ID. `null` when there is none.',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      custom_provider_deployment_id: v.nullable(
        v.string({
          name: 'custom_provider_deployment_id',
          description: 'Deployment this commit built. `null` when there is none.',
          examples: ['cpd_1aBcDeFgHjKlMnPq']
        })
      ),
      to_environment: v1CustomProviderEnvironmentPresenter.schema,
      from_environment: v.nullable(v1CustomProviderEnvironmentPresenter.schema, {
        description: 'Environment the version is promoted from. `null` for rollbacks.'
      }),
      target_custom_provider_version: v1CustomProviderVersionPresenter.schema,
      previous_custom_provider_version: v.nullable(v1CustomProviderVersionPresenter.schema, {
        description: 'Version previously in the environment. `null` when there was none.'
      }),
      actor: v1ActorPreviewPresenter.schema,
      scm_push: v.nullable(v1ScmPushPresenter.schema, {
        description: 'SCM push that triggered the commit. `null` unless `trigger` is `scm`.'
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      applied_at: v.nullable(
        v.date({
          name: 'applied_at',
          description: 'When the commit took effect. `null` while `status` is `pending`.',
          examples: [new Date('2025-09-15T10:35:00Z')]
        })
      )
    })
  )
  .build();
