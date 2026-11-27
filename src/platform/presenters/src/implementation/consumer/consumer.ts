import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { consumerType } from '../../types';

export let v1ConsumerPresenter = Presenter.create(consumerType)
  .presenter(async ({ consumer }) => ({
    object: 'consumer' as const,
    id: consumer.id,
    name: consumer.name,
    email: consumer.email,
    image_url: await getImageUrl(
      consumer.consumer.user ?? {
        id: consumer.consumer.id,
        name: consumer.name,
        email: consumer.email,
        image: null
      }
    ),
    user_id: consumer.consumer.user?.id ?? null,
    created_at: consumer.createdAt,
    updated_at: consumer.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      name: v.string({ description: 'Display name.' }),
      email: v.string({ description: 'Email address.' }),
      image_url: v.string({ description: 'Avatar image URL.' }),
      user_id: v.nullable(
        v.string({ description: 'User this consumer is linked to. `null` when unlinked.' })
      ),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
    })
  )
  .build();

export let dashboardConsumerPresenter = Presenter.create(consumerType)
  .presenter(async ({ consumer }, opts) => {
    let inner = await v1ConsumerPresenter.present({ consumer }, opts).run();

    return {
      ...inner,
      is_portal_consumer: consumer.consumer.isPortalConsumer,
      is_organization_member: consumer.consumer.isOrganizationMember,
      is_service_account: consumer.consumer.isServiceAccount
    };
  })
  .schema(
    v.intersection([
      v1ConsumerPresenter.schema,
      v.object({
        is_portal_consumer: v.boolean({
          description: 'Whether this consumer signs in through a portal.'
        }),
        is_organization_member: v.boolean({
          description: 'Whether this consumer is an organization member.'
        }),
        is_service_account: v.boolean({
          name: 'is_service_account',
          description: 'Whether this consumer is the dedicated identity of a service account'
        })
      })
    ])
  )
  .build();
