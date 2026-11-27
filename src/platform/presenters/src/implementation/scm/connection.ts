import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
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
        ? await getImageUrl({
            id: scmConnection.externalAccountId,
            name: scmConnection.externalAccountName,
            image: { type: 'url', url: scmConnection.externalAccountImageUrl }
          })
        : null
    },

    created_at: scmConnection.createdAt,
    updated_at: scmConnection.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.connection', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      provider: v.enumOf(['github', 'gitlab', 'bitbucket'], {
        description: 'Provider this connection is for.'
      }),
      external_installation_id: v.nullable(
        v.string({ description: 'Installation ID on the provider.' })
      ),
      account_type: v.nullable(
        v.enumOf(['user', 'organization'], {
          description: 'Whether the connected account is a user or an organization.'
        })
      ),
      external_account: v.object(
        {
          id: v.string({ description: 'ID of the account on the provider.' }),
          login: v.string({ description: 'Login of the account on the provider.' }),
          name: v.nullable(v.string({ description: 'Name of the account on the provider.' })),
          email: v.nullable(
            v.string({ description: 'Email of the account on the provider.' })
          ),
          image_url: v.nullable(v.string({ description: 'Profile image URL.' }))
        },
        { description: 'Account this connection is authorized as.' }
      ),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
    })
  )
  .build();

export let v1ScmConnectionSetupPresenter = Presenter.create(scmConnectionSetupType)
  .presenter(async ({ scmConnectionSetup }, opts) => ({
    object: 'scm.connection.setup_session' as const,

    id: scmConnectionSetup.id,

    url: scmConnectionSetup.url,
    status: scmConnectionSetup.status,

    connection: scmConnectionSetup.installation
      ? await v1ScmConnectionPresenter
          .present({ scmConnection: scmConnectionSetup.installation }, opts)
          .run()
      : null,

    created_at: scmConnectionSetup.createdAt,
    expires_at: scmConnectionSetup.expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.connection.setup_session', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      url: v.string({ description: 'URL to open for completing authorization.' }),
      status: v.enumOf(['pending', 'completed', 'expired'], {
        description: '`pending` until authorization completes.'
      }),
      connection: v.nullable(v1ScmConnectionPresenter.schema, {
        description: 'Connection created by this session. `null` until the session completes.'
      }),
      created_at: v.date({ description: 'Creation time.' }),
      expires_at: v.date({ description: 'When the setup session expires.' })
    })
  )
  .build();
