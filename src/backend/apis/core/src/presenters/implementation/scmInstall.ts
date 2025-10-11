import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { scmInstallType } from '../types';

export let v1ScmInstallPresenter = Presenter.create(scmInstallType)
  .presenter(async ({ authorizationUrl }, opts) => ({
    object: 'integrations.scm.install',

    authorizationUrl
  }))
  .schema(
    v.object({
      object: v.literal('integrations.scm.install'),

      authorizationUrl: v.string({
        name: 'authorization_url',
        description: 'The URL to redirect the user to for installing the SCM integration'
      })
    })
  )
  .build();
