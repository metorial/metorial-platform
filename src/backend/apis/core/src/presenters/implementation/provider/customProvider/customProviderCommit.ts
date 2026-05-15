import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { customProviderCommitType } from '../../../types';
import { v1ActorPreviewPresenter } from './actorPreview';
import { v1CustomProviderEnvironmentPresenter } from './customProviderEnvironment';
import { v1CustomProviderVersionPresenter } from './customProviderVersion';
import { v1ScmPushPresenter } from '../scm/scmPush';

export let v1CustomProviderCommitPresenter = Presenter.create(customProviderCommitType)
  .presenter(async ({ customProviderCommit }, opts) => ({
    object: 'custom_provider.commit' as const,

    id: customProviderCommit.id,
    status: customProviderCommit.status,
    trigger: customProviderCommit.trigger,
    // type: customProviderCommit.type,

    error: customProviderCommit.error,

    custom_provider_id: customProviderCommit.customProviderId,
    provider_id: customProviderCommit.providerId ?? null,
    custom_provider_deployment_id: customProviderCommit.customProviderDeploymentId ?? null,

    to_environment: await v1CustomProviderEnvironmentPresenter
      .present({ customProviderEnvironment: customProviderCommit.toEnvironment }, opts)
      .run(),
    from_environment: customProviderCommit.fromEnvironment
      ? await v1CustomProviderEnvironmentPresenter
          .present({ customProviderEnvironment: customProviderCommit.fromEnvironment }, opts)
          .run()
      : null,

    target_custom_provider_version: await v1CustomProviderVersionPresenter
      .present(
        { customProviderVersion: customProviderCommit.targetCustomProviderVersion },
        opts
      )
      .run(),
    previous_custom_provider_version: customProviderCommit.previousCustomProviderVersion
      ? await v1CustomProviderVersionPresenter
          .present(
            { customProviderVersion: customProviderCommit.previousCustomProviderVersion },
            opts
          )
          .run()
      : null,

    actor: await v1ActorPreviewPresenter
      .present({ actor: customProviderCommit.actor }, opts)
      .run(),

    scm_push: customProviderCommit.scmPush
      ? await v1ScmPushPresenter.present({ scmPush: customProviderCommit.scmPush }, opts).run()
      : null,

    created_at: customProviderCommit.createdAt,
    applied_at: customProviderCommit.appliedAt
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
      status: v.enumOf(['pending', 'applied', 'failed'], {
        name: 'status',
        description: 'Current commit status'
      }),
      trigger: v.enumOf(['manual', 'system', 'scm'], {
        name: 'trigger',
        description: 'What triggered this commit'
      }),
      // type: v.enumOf(["create_version" , "merge_version_into_environment" , "rollback_to_version"], {
      //   name: 'type',
      //   description: 'The type of commit action',
      // }),
      error: v.nullable(
        v.object({
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
      custom_provider_deployment_id: v.nullable(
        v.string({
          name: 'custom_provider_deployment_id',
          description: 'ID of the associated deployment',
          examples: ['cpd_1aBcDeFgHjKlMnPq']
        })
      ),
      to_environment: v1CustomProviderEnvironmentPresenter.schema,
      from_environment: v.nullable(v1CustomProviderEnvironmentPresenter.schema),
      target_custom_provider_version: v1CustomProviderVersionPresenter.schema,
      previous_custom_provider_version: v.nullable(v1CustomProviderVersionPresenter.schema),
      actor: v1ActorPreviewPresenter.schema,
      scm_push: v.nullable(v1ScmPushPresenter.schema),
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
