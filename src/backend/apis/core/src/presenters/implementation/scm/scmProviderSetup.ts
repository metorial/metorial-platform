import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { scmProviderSetupType } from '../../types';
import { v1ScmProviderPresenter } from './scmProvider';

export let v1ScmProviderSetupPresenter = Presenter.create(scmProviderSetupType)
  .presenter(async ({ scmProviderSetup }, opts) => ({
    object: 'scm.provider.setup_session' as const,

    id: scmProviderSetup.id,

    type: scmProviderSetup.type,
    url: scmProviderSetup.url,
    status: scmProviderSetup.status,

    provider: scmProviderSetup.provider
      ? await v1ScmProviderPresenter
          .present({ scmProvider: scmProviderSetup.provider }, opts)
          .run()
      : null,

    created_at: scmProviderSetup.createdAt,
    expires_at: scmProviderSetup.expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.provider.setup_session'),
      id: v.string({ description: 'Unique setup session identifier' }),
      type: v.string({ description: 'SCM backend type' }),
      url: v.string({ description: 'Setup URL' }),
      status: v.enumOf(['pending', 'completed', 'expired'] as const, {
        description: 'Status of the provider setup session'
      }),
      provider: v.nullable(v1ScmProviderPresenter.schema),
      created_at: v.date({ description: 'Timestamp when created' }),
      expires_at: v.date({ description: 'Timestamp when the session expires' })
    })
  )
  .build();
