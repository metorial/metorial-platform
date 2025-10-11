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
      external_id: scmRepoPreview.externalId,
      created_at: scmRepoPreview.createdAt,
      updated_at: scmRepoPreview.updatedAt,
      lastPushed_at: scmRepoPreview.lastPushedAt,
      account: {
        external_id: scmRepoPreview.account.externalId,
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
          external_id: v.string({
            name: 'external_id',
            description: `The SCM repository's external ID`
          }),
          created_at: v.date({ name: 'created_at', description: 'When the repo was created' }),
          updated_at: v.date({
            name: 'updated_at',
            description: 'When the repo was last updated'
          }),
          lastPushed_at: v.nullable(
            v.date({ name: 'last_pushed_at', description: 'When the repo was last pushed to' })
          ),
          account: v.object(
            {
              external_id: v.string({
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
