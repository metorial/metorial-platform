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
      object: v.literal('scm.repository.list#preview', {
        description: 'String representing the object’s type.'
      }),
      repos: v.array(
        v.object({
          object: v.literal('scm.repository.item#preview', {
            description: 'String representing the object’s type.'
          }),
          provider: v.enumOf(['github', 'gitlab', 'bitbucket'], {
            description: 'Provider the repository lives on.'
          }),
          external_id: v.string({ description: 'ID of the repository on the provider.' }),
          name: v.string({ description: 'Name of the repository on the provider.' }),
          identifier: v.string({ description: 'Full name of the repository on the provider.' })
        }),
        { description: 'Repositories the installation can access.' }
      ),
      next_cursor: v.optional(v.string({ description: 'Cursor for fetching the next page.' }))
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
      object: v.literal('scm.repository', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      provider: v.object(
        {
          object: v.literal('scm.provider', {
            description: 'String representing the object’s type.'
          }),
          type: v.enumOf(['github', 'gitlab', 'bitbucket'], {
            description: 'Provider the repository lives on.'
          }),
          id: v.string({ description: 'ID of the repository on the provider.' }),
          name: v.string({ description: 'Name of the repository on the provider.' }),
          owner: v.string({ description: 'Owner of the repository on the provider.' })
        },
        { description: 'Provider the repository lives on.' }
      ),
      url: v.string({ description: 'Web URL of the repository.' }),
      is_private: v.boolean({ description: 'Whether the repository is private.' }),
      default_branch: v.string({ description: 'Branch used when none is specified.' }),
      created_at: v.date({ description: 'Creation time.' })
    })
  )
  .build();
