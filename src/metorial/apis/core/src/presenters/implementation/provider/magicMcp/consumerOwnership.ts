import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import {
  consumerIntegrationEndpointType,
  consumerIntegrationSessionType,
  consumerIntegrationType,
  consumerTokenType
} from '../../../types';

export let v1ConsumerTokenPresenter = Presenter.create(consumerTokenType)
  .presenter(async ({ consumerToken }) => ({
    object: 'consumer.token' as const,
    id: consumerToken.id,
    consumer_id: consumerToken.consumer.id,
    consumer_profile_id: consumerToken.consumerProfile.id,
    created_at: consumerToken.createdAt,
    updated_at: consumerToken.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.token'),
      id: v.string(),
      consumer_id: v.string(),
      consumer_profile_id: v.string(),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1ConsumerIntegrationPresenter = Presenter.create(consumerIntegrationType)
  .presenter(async ({ consumerIntegration }) => ({
    object: 'consumer.integration' as const,
    id: consumerIntegration.id,
    is_managed: consumerIntegration.isManaged,
    consumer_id: consumerIntegration.consumer.id,
    consumer_profile_id: consumerIntegration.consumerProfile.id,
    created_at: consumerIntegration.createdAt,
    updated_at: consumerIntegration.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.integration'),
      id: v.string(),
      is_managed: v.boolean(),
      consumer_id: v.string(),
      consumer_profile_id: v.string(),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1ConsumerIntegrationEndpointPresenter = Presenter.create(
  consumerIntegrationEndpointType
)
  .presenter(async ({ consumerIntegrationEndpoint }) => ({
    object: 'consumer.integration_endpoint' as const,
    id: consumerIntegrationEndpoint.id,
    is_managed: consumerIntegrationEndpoint.isManaged,
    consumer_id: consumerIntegrationEndpoint.consumer.id,
    consumer_profile_id: consumerIntegrationEndpoint.consumerProfile.id,
    created_at: consumerIntegrationEndpoint.createdAt,
    updated_at: consumerIntegrationEndpoint.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.integration_endpoint'),
      id: v.string(),
      is_managed: v.boolean(),
      consumer_id: v.string(),
      consumer_profile_id: v.string(),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1ConsumerIntegrationSessionPresenter = Presenter.create(
  consumerIntegrationSessionType
)
  .presenter(async ({ consumerIntegrationSession }, opts) => ({
    object: 'consumer.integration_session' as const,
    id: consumerIntegrationSession.id,
    consumer_id: consumerIntegrationSession.consumer.id,
    consumer_profile_id: consumerIntegrationSession.consumerProfile.id,
    consumer_integration: await v1ConsumerIntegrationPresenter
      .present(
        {
          consumerIntegration: consumerIntegrationSession.consumerIntegration
        },
        opts
      )
      .run(),
    created_at: consumerIntegrationSession.createdAt,
    updated_at: consumerIntegrationSession.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.integration_session'),
      id: v.string(),
      consumer_id: v.string(),
      consumer_profile_id: v.string(),
      consumer_integration: v1ConsumerIntegrationPresenter.schema,
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
