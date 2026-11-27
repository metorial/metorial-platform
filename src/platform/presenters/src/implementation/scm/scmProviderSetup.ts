import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { scmProviderSetupType } from '../../types';
import { v1ScmProviderPresenter } from './scmProvider';

export let v1ScmProviderSetupPresenter = Presenter.create(scmProviderSetupType)
  .presenter(async ({ scmProviderSetup }, opts) => ({
    object: 'scm.provider.setup_session' as const,

    id: scmProviderSetup.id,

    type: scmProviderSetup.type,
    url: scmProviderSetup.url,
    status: scmProviderSetup.status,

    provider: scmProviderSetup.backend
      ? await v1ScmProviderPresenter
          .present({ scmProvider: scmProviderSetup.backend }, opts)
          .run()
      : null,

    created_at: scmProviderSetup.createdAt,
    expires_at: scmProviderSetup.expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.provider.setup_session', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      type: v.enumOf(
        [
          'github',
          'github_enterprise',
          'gitlab',
          'gitlab_selfhosted',
          'bitbucket',
          'bitbucket_data_center'
        ],
        {
          description: 'Provider software this connects to.'
        }
      ),
      url: v.string({ description: 'URL to open for completing setup.' }),
      status: v.enumOf(['pending', 'completed', 'expired'] as const, {
        description: '`pending` until setup completes.'
      }),
      provider: v.nullable(v1ScmProviderPresenter.schema, {
        description: 'Provider created by this session. `null` until the session completes.'
      }),
      created_at: v.date({ description: 'Creation time.' }),
      expires_at: v.date({ description: 'When the setup session expires.' })
    })
  )
  .build();
