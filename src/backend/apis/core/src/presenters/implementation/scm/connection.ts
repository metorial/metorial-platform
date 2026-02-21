import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { scmConnectionSetupType, scmConnectionType } from '../../types';

export let v1ScmConnectionPresenter = Presenter.create(scmConnectionType)
  .presenter(async ({ scmConnection }) => ({
    object: 'scm.connection' as const,
    id: scmConnection.id,
    provider: scmConnection.provider,
    user: {
      id: scmConnection.externalAccountId,
      name: scmConnection.externalAccountName ?? scmConnection.externalAccountLogin,
      email: scmConnection.externalAccountEmail ?? '',
      image_url: scmConnection.externalAccountImageUrl
    },
    created_at: scmConnection.createdAt,
    updated_at: scmConnection.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.connection'),
      id: v.string(),
      provider: v.string(),
      user: v.object({
        id: v.string(),
        name: v.string(),
        email: v.string(),
        image_url: v.nullable(v.string())
      }),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1ScmConnectionSetupPresenter = Presenter.create(scmConnectionSetupType)
  .presenter(async ({ scmConnectionSetup }) => ({
    object: 'scm.connection_setup' as const,
    id: scmConnectionSetup.id,
    authorization_url: scmConnectionSetup.url,
    status: scmConnectionSetup.status
  }))
  .schema(
    v.object({
      object: v.literal('scm.connection_setup'),
      id: v.string(),
      authorization_url: v.string(),
      status: v.enumOf(['pending', 'completed', 'expired'] as const, {
        name: 'status',
        description: 'Status of the connection setup'
      })
    })
  )
  .build();
