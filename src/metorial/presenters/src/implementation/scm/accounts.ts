import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { scmAccountPreviewType } from '../../types';

export let v1ScmAccountPreviewPresenter = Presenter.create(scmAccountPreviewType)
  .presenter(async ({ accountPreviews }) => ({
    object: 'scm.account.list#preview' as const,

    accounts: await Promise.all(
      accountPreviews.map(async a => ({
        object: 'scm.account.item#preview' as const,
        provider: a.provider,
        external_id: a.externalId,
        name: a.name,
        identifier: a.identifier,
        image_url: a.imageUrl
          ? await getImageUrl({
              id: a.externalId,
              name: a.name,
              image: { type: 'url', url: a.imageUrl }
            })
          : null
      }))
    )
  }))
  .schema(
    v.object({
      object: v.literal('scm.account.list#preview', {
        description: 'String representing the object’s type.'
      }),
      accounts: v.array(
        v.object({
          object: v.literal('scm.account.item#preview', {
            description: 'String representing the object’s type.'
          }),
          provider: v.enumOf(['github', 'gitlab', 'bitbucket'], {
            description: 'Provider the account belongs to.'
          }),
          external_id: v.string({ description: 'ID of the account on the provider.' }),
          name: v.string({ description: 'Name of the account on the provider.' }),
          identifier: v.string({ description: 'Username of the account on the provider.' }),
          image_url: v.nullable(
            v.string({
              description: 'Profile image URL. `null` when the account has no image.'
            })
          )
        }),
        { description: 'Accounts the installation can access.' }
      )
    })
  )
  .build();
