import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { scmRepoPreviewType, scmRepoType } from '../../types';

export let v1ScmRepoPreviewPresenter = Presenter.create(scmRepoPreviewType)
  .presenter(async ({ repoPreviews }) => ({
    object: 'scm.repository.list#preview' as const,

    repos: repoPreviews.repositories.map((r: any) => ({
      object: 'scm.repository.item#preview' as const,

      provider: r.provider,
      external_id: r.externalId,
      name: r.name,
      identifier: r.identifier
    })),

    ...(repoPreviews.nextCursor ? { next_cursor: repoPreviews.nextCursor } : {})
  }))
  .schema(
    v.object({
      object: v.literal('scm.repository.list#preview'),
      repos: v.array(
        v.object({
          object: v.literal('scm.repository.item#preview', {
            description: "String representing the repository preview item's type"
          }),
          provider: v.enumOf(['github', 'gitlab', 'bitbucket'], {
            description: 'SCM provider type'
          }),
          external_id: v.string({ description: 'External repository identifier' }),
          name: v.string({ description: 'Repository name' }),
          identifier: v.string({ description: 'Repository identifier (e.g. full name)' })
        })
      ),
      next_cursor: v.optional(
        v.string({ description: 'Cursor for the next repository preview page' })
      )
    })
  )
  .build();

export let v1ScmRepoPresenter = Presenter.create(scmRepoType)
  .presenter(async ({ scmRepo }) => {
    return {
      object: 'scm.repository' as const,

      id: scmRepo.id,

      provider: {
        object: 'scm.provider' as const,
        type: scmRepo.provider,
        id: scmRepo.externalId,
        name: scmRepo.externalName,
        owner: scmRepo.externalOwner
      },

      url: scmRepo.externalUrl,

      is_private: scmRepo.externalIsPrivate,
      default_branch: scmRepo.defaultBranch,

      created_at: scmRepo.createdAt
    };
  })
  .schema(
    v.object({
      object: v.literal('scm.repository'),
      id: v.string({ description: 'Unique repository identifier' }),
      provider: v.object({
        object: v.literal('scm.provider'),
        type: v.enumOf(['github', 'gitlab', 'bitbucket'], {
          description: 'SCM provider type'
        }),
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
