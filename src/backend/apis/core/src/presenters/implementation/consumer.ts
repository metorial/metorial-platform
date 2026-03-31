import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerType } from '../types';

export let v1ConsumerPresenter = Presenter.create(consumerType)
  .presenter(async ({ consumer }) => ({
    object: 'consumer' as const,
    id: consumer.id,
    name: consumer.name,
    email: consumer.email,
    created_at: consumer.createdAt,
    updated_at: consumer.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer'),
      id: v.string(),
      name: v.string(),
      email: v.string(),

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let dashboardConsumerPresenter = Presenter.create(consumerType)
  .presenter(async ({ consumer }, opts) => {
    let inner = await v1ConsumerPresenter.present({ consumer }, opts).run();

    return {
      ...inner,
      is_portal_consumer: consumer.consumer.isPortalConsumer,
      is_organization_member: consumer.consumer.isOrganizationMember
    };
  })
  .schema(
    v.intersection([
      v1ConsumerPresenter.schema,
      v.object({
        is_portal_consumer: v.boolean(),
        is_organization_member: v.boolean()
      })
    ])
  )
  .build();
