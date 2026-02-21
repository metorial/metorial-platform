import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { scmRepoPreviewType, scmRepoType } from '../../types';

export let v1ScmRepoPreviewPresenter = Presenter.create(scmRepoPreviewType)
  .presenter(async ({ repoPreview }) => ({
    object: 'scm.repository#preview' as const,
    provider: repoPreview.provider,
    external_id: repoPreview.externalId,
    name: repoPreview.name,
    identifier: repoPreview.identifier
  }))
  .schema(
    v.object({
      object: v.literal('scm.repository#preview'),
      provider: v.enumOf(['github', 'gitlab'], { description: 'SCM provider type' }),
      external_id: v.string({ description: 'External repository identifier' }),
      name: v.string({ description: 'Repository name' }),
      identifier: v.string({ description: 'Repository identifier' })
    })
  )
  .build();

export let v1ScmRepoPresenter = Presenter.create(scmRepoType)
  .presenter(async ({ scmRepo }) => ({
    object: 'scm.repository' as const,

    id: scmRepo.id,

    provider: {
      object: 'scm.provider' as const,
      type: scmRepo.provider.type,
      id: scmRepo.provider.id,
      name: scmRepo.provider.name,
      owner: scmRepo.provider.owner
    },

    url: scmRepo.url,

    is_private: scmRepo.isPrivate,
    default_branch: scmRepo.defaultBranch,

    created_at: scmRepo.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.repository'),
      id: v.string({ description: 'Unique repository identifier' }),
      provider: v.object({
        object: v.literal('scm.provider'),
        type: v.enumOf(['github', 'gitlab'], { description: 'SCM provider type' }),
        id: v.string({ description: 'External provider identifier' }),
        name: v.string({ description: 'Repository name on the provider' }),
        owner: v.string({ description: 'Repository owner on the provider' })
      }),
      url: v.string({ description: 'Repository URL' }),
      is_private: v.boolean({ description: 'Whether the repository is private' }),
      default_branch: v.string({ description: 'Default branch name' }),
      created_at: v.date({ description: 'Timestamp when created' })
    })
  )
  .build();
