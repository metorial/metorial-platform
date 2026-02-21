import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { scmInstallationSetupType, scmInstallationType } from '../../types';

export let v1ScmInstallationPresenter = Presenter.create(scmInstallationType)
  .presenter(async ({ scmInstallation }) => ({
    object: 'scm.installation' as const,
    id: scmInstallation.id,
    provider: scmInstallation.provider,
    user: {
      id: scmInstallation.externalAccountId,
      name: scmInstallation.externalAccountName ?? scmInstallation.externalAccountLogin,
      email: '',
      image_url: scmInstallation.externalAccountImageUrl
    },
    created_at: scmInstallation.createdAt,
    updated_at: scmInstallation.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.installation'),
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

export let v1ScmInstallationSetupPresenter = Presenter.create(scmInstallationSetupType)
  .presenter(async ({ url, id }) => ({
    object: 'scm.installation_setup' as const,
    id,
    authorization_url: url
  }))
  .schema(
    v.object({
      object: v.literal('scm.installation_setup'),
      id: v.string(),
      authorization_url: v.string()
    })
  )
  .build();
