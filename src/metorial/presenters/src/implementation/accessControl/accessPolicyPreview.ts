import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { accessPolicyPreviewType } from '../../types';

export let v1AccessPolicyPreviewPresenter = Presenter.create(accessPolicyPreviewType)
  .presenter(async ({ accessPolicy }) => ({
    object: 'management.access_policy#preview',
    id: accessPolicy.id,
    type: accessPolicy.type,
    name: accessPolicy.name,
    slug: accessPolicy.slug
  }))
  .schema(
    v.object({
      object: v.literal('management.access_policy#preview', {
        description: 'String representing the preview access policy object type'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique identifier of the access policy',
        examples: ['apl_7hNkPqRsTuVwXyZa']
      }),
      type: v.enumOf(['everyone', 'admin', 'custom'], {
        name: 'type',
        description:
          'Policy kind. Default policies are reserved system policies; custom policies are user-managed.'
      }),
      name: v.string({
        name: 'name',
        description: 'Human-readable access policy name',
        examples: ['Support Engineers']
      }),
      slug: v.string({
        name: 'slug',
        description: 'Stable slug for the access policy',
        examples: ['support-engineers']
      })
    })
  )
  .build();
