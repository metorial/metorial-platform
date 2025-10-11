import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { scmRepoType } from '../types';

export let v1ScmRepoPresenter = Presenter.create(scmRepoType)
  .presenter(async ({ scmRepo }, opts) => ({
    object: 'integrations.scm.repo',

    id: scmRepo.id,
    provider: scmRepo.provider,
    name: scmRepo.name,
    identifier: scmRepo.identifier,
    external_id: scmRepo.externalId,
    account: {
      id: scmRepo.account.id,
      external_id: scmRepo.account.externalId,
      name: scmRepo.account.name,
      identifier: scmRepo.account.identifier,
      provider: scmRepo.account.provider,
      created_at: scmRepo.account.createdAt,
      updated_at: scmRepo.account.updatedAt
    },
    created_at: scmRepo.createdAt,
    updated_at: scmRepo.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('integrations.scm.repo'),

      id: v.string({ name: 'id', description: `The SCM repository's unique identifier` }),
      provider: v.enumOf(['github'], { name: 'provider', description: `The SCM provider` }),
      name: v.string({ name: 'name', description: `The SCM repository's name` }),
      identifier: v.string({
        name: 'identifier',
        description: `The SCM repository's identifier`
      }),
      external_id: v.string({
        name: 'external_id',
        description: `The SCM repository's external ID`
      }),
      account: v.object(
        {
          id: v.string({ name: 'id', description: `The SCM account's unique identifier` }),
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
          }),
          created_at: v.date({
            name: 'created_at',
            description: `The SCM account's creation date`
          }),
          updated_at: v.date({
            name: 'updated_at',
            description: `The SCM account's last update date`
          })
        },
        { name: 'account', description: `The SCM account` }
      ),
      created_at: v.date({
        name: 'created_at',
        description: `The SCM repository's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The SCM repository's last update date`
      })
    })
  )
  .build();
