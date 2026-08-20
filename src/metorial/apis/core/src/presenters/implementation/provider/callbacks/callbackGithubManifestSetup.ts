import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackGithubManifestSetupType } from '../../../types';

export let v1CallbackGithubManifestSetupPresenter = Presenter.create(
  callbackGithubManifestSetupType
)
  .presenter(async ({ setup }) => ({
    object: 'callback.github_manifest_setup' as const,
    redirect_url: setup.redirectUrl,
    expires_at: setup.expiresAt,
    generation: setup.generation
  }))
  .schema(
    v.object({
      object: v.literal('callback.github_manifest_setup'),
      redirect_url: v.string({ description: 'Authorized GitHub manifest setup URL' }),
      expires_at: v.date({ description: 'Time when this setup URL expires' }),
      generation: v.number({ description: 'Provisioned app generation after setup begins' })
    })
  )
  .build();
