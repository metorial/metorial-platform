import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { scmInstallationType } from '../types';

export let v1ScmInstallationPresenter = Presenter.create(scmInstallationType)
  .presenter(async ({ scmInstallation }, opts) => ({
    object: 'integrations.scm.repo',

    id: scmInstallation.id,
    provider: scmInstallation.provider,

    user: {
      id: scmInstallation.externalUserId,
      name: scmInstallation.externalUserName,
      email: scmInstallation.externalUserEmail,
      imageUrl: scmInstallation.externalUserImageUrl
    },

    createdAt: scmInstallation.createdAt,
    updatedAt: scmInstallation.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('integrations.scm.repo'),

      id: v.string({ name: 'id', description: `The SCM repository's unique identifier` }),
      provider: v.enumOf(['github'], { name: 'provider', description: `The SCM provider` }),
      user: v.object(
        {
          id: v.string({ name: 'id', description: `The SCM user's unique identifier` }),
          name: v.string({ name: 'name', description: `The SCM user's name` }),
          email: v.string({ name: 'email', description: `The SCM user's email` }),
          imageUrl: v.string({ name: 'image_url', description: `The SCM user's image URL` })
        },
        { name: 'user', description: `The SCM user associated with the installation` }
      ),
      createdAt: v.date({
        name: 'created_at',
        description: `The SCM repository's creation date`
      }),
      updatedAt: v.date({
        name: 'updated_at',
        description: `The SCM repository's last update date`
      })
    })
  )
  .build();
