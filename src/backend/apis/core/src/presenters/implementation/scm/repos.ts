import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { scmRepoPreviewType, scmRepoType } from '../../types';

export let v1ScmRepoPreviewPresenter = Presenter.create(scmRepoPreviewType)
  .presenter(async ({ repoPreview }) => ({
    provider: repoPreview.provider,
    external_id: repoPreview.externalId,
    name: repoPreview.name,
    identifier: repoPreview.identifier,
    last_pushed_at: repoPreview.lastPushedAt ?? null,
    account: repoPreview.account
      ? {
          external_id: repoPreview.account.externalId,
          name: repoPreview.account.name,
          identifier: repoPreview.account.identifier,
          provider: repoPreview.account.provider
        }
      : null
  }))
  .schema(
    v.object({
      provider: v.string(),
      external_id: v.string(),
      name: v.string(),
      identifier: v.string(),
      last_pushed_at: v.nullable(v.date()),
      account: v.nullable(
        v.object({
          external_id: v.string(),
          name: v.string(),
          identifier: v.string(),
          provider: v.string()
        })
      )
    })
  )
  .build();

export let v1ScmRepoPresenter = Presenter.create(scmRepoType)
  .presenter(async ({ scmRepo }) => ({
    object: 'scm.repo' as const,
    id: scmRepo.id,
    provider: scmRepo.provider,
    url: scmRepo.url,
    is_private: scmRepo.isPrivate,
    default_branch: scmRepo.defaultBranch,
    created_at: scmRepo.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.repo'),
      id: v.string(),
      provider: v.object({
        type: v.string(),
        id: v.string(),
        name: v.string(),
        owner: v.string()
      }),
      url: v.string(),
      is_private: v.boolean(),
      default_branch: v.string(),
      created_at: v.date()
    })
  )
  .build();
