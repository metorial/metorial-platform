import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { scmRepoPreviewType } from '../types';

export let v1ScmRepoPreviewPresenter = Presenter.create(scmRepoPreviewType)
  .presenter(async ({ scmRepoPreviews }, opts) => ({
    object: 'integrations.scm.repo#preview',

    items: scmRepoPreviews.map(scmRepoPreview => ({
      provider: scmRepoPreview.provider,
      name: scmRepoPreview.name,
      identifier: scmRepoPreview.identifier,
      externalId: scmRepoPreview.externalId,
      createdAt: scmRepoPreview.createdAt,
      updatedAt: scmRepoPreview.updatedAt,
      lastPushedAt: scmRepoPreview.lastPushedAt,
      account: {
        externalId: scmRepoPreview.account.externalId,
        name: scmRepoPreview.account.name,
        identifier: scmRepoPreview.account.identifier,
        provider: scmRepoPreview.account.provider
      }
    }))
  }))
  .schema(
    v.object({
      object: v.literal('integrations.scm.repo#preview'),

      items: v.array(
        v.object({
          provider: v.enumOf(['github'], {
            name: 'provider',
            description: `The SCM provider`
          }),
          name: v.string({ name: 'name', description: `The SCM repository's name` }),
          identifier: v.string({
            name: 'identifier',
            description: `The SCM repository's identifier`
          }),
          externalId: v.string({
            name: 'external_id',
            description: `The SCM repository's external ID`
          }),
          createdAt: v.date({ name: 'created_at', description: 'When the repo was created' }),
          updatedAt: v.date({
            name: 'updated_at',
            description: 'When the repo was last updated'
          }),
          lastPushedAt: v.nullable(
            v.date({ name: 'last_pushed_at', description: 'When the repo was last pushed to' })
          ),
          account: v.object(
            {
              externalId: v.string({
                name: 'external_id',
                description: `The SCM account's external ID`
              }),
              name: v.string({ name: 'name', description: `The SCM account's name` }),
              identifier: v.string({
                name: 'identifier',
                description: `The SCM account's identifier`
              }),
              provider: v.enumOf(['github'], {
                name: 'provider',
                description: `The SCM provider`
              })
            },
            { name: 'account', description: `The SCM account` }
          )
        })
      )
    })
  )
  .build();
