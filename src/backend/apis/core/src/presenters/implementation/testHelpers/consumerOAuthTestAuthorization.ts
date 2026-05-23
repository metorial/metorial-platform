import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { consumerOAuthTestAuthorizationType } from '../../types';

export let v1ConsumerOAuthTestAuthorizationPresenter = Presenter.create(
  consumerOAuthTestAuthorizationType
)
  .presenter(async ({ testAuthorization, url }) => ({
    object: 'test_helper.consumer_oauth_authorization' as const,
    id: testAuthorization.id,
    url,
    expires_at: testAuthorization.expiresAt,
    created_at: testAuthorization.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('test_helper.consumer_oauth_authorization'),
      id: v.string(),
      url: v.string(),
      expires_at: v.date(),
      created_at: v.date()
    })
  )
  .build();
