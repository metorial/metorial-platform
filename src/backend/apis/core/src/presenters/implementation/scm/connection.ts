import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { scmConnectionSetupType, scmConnectionType } from '../../types';

export let v1ScmConnectionPresenter = Presenter.create(scmConnectionType)
  .presenter(async ({ scmConnection }) => ({
    object: 'scm.connection' as const,

    id: scmConnection.id,
    provider: scmConnection.provider,

    external_installation_id: scmConnection.externalInstallationId,
    account_type: scmConnection.accountType,

    external_account: {
      id: scmConnection.externalAccountId,
      login: scmConnection.externalAccountLogin,
      name: scmConnection.externalAccountName,
      email: scmConnection.externalAccountEmail,
      image_url: scmConnection.externalAccountImageUrl
    },

    created_at: scmConnection.createdAt,
    updated_at: scmConnection.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.connection'),
      id: v.string({ description: 'Unique SCM connection identifier' }),
      provider: v.enumOf(['github', 'github_enterprise', 'gitlab', 'gitlab_selfhosted'], {
        description: 'SCM provider type'
      }),
      external_installation_id: v.nullable(
        v.string({ description: 'External installation identifier' })
      ),
      account_type: v.nullable(
        v.enumOf(['user', 'organization'], { description: 'Account type' })
      ),
      external_account: v.object({
        id: v.string({ description: 'External account identifier' }),
        login: v.string({ description: 'External account login' }),
        name: v.nullable(v.string({ description: 'External account name' })),
        email: v.nullable(v.string({ description: 'External account email' })),
        image_url: v.nullable(v.string({ description: 'External account image URL' }))
      }),
      created_at: v.date({ description: 'Timestamp when created' }),
      updated_at: v.date({ description: 'Timestamp when last updated' })
    })
  )
  .build();

export let v1ScmConnectionSetupPresenter = Presenter.create(scmConnectionSetupType)
  .presenter(async ({ scmConnectionSetup }, opts) => ({
    object: 'scm.connection.setup_session' as const,

    id: scmConnectionSetup.id,

    url: scmConnectionSetup.url,
    status: scmConnectionSetup.status,

    connection: scmConnectionSetup.connection
      ? await v1ScmConnectionPresenter
          .present({ scmConnection: scmConnectionSetup.connection }, opts)
          .run()
      : null,

    created_at: scmConnectionSetup.createdAt,
    expires_at: scmConnectionSetup.expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.connection.setup_session'),
      id: v.string({ description: 'Unique setup session identifier' }),
      url: v.string({ description: 'Authorization URL' }),
      status: v.enumOf(['pending', 'completed', 'expired'], {
        description: 'Status of the connection setup session'
      }),
      connection: v.nullable(v1ScmConnectionPresenter.schema),
      created_at: v.date({ description: 'Timestamp when created' }),
      expires_at: v.date({ description: 'Timestamp when the session expires' })
    })
  )
  .build();
