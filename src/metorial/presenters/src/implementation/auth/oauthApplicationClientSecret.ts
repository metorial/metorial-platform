import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { oauthApplicationClientSecretType } from '../../types';

export let v1OAuthApplicationClientSecretPresenter = Presenter.create(
  oauthApplicationClientSecretType
)
  .presenter(async ({ oauthApplicationClientSecret, secret }) => ({
    object: 'machine_access.oauth_application_client_secret',

    id: oauthApplicationClientSecret.id,
    preview: oauthApplicationClientSecret.secretPreview,
    secret: secret ?? null,
    created_at: oauthApplicationClientSecret.createdAt,
    deleted_at: oauthApplicationClientSecret.deletedAt
  }))
  .schema(
    v.object({
      object: v.literal('machine_access.oauth_application_client_secret', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique OAuth application client secret identifier',
        examples: ['cse_4sTuVwXyZaBcDeFg']
      }),
      preview: v.string({
        name: 'preview',
        description: 'Redacted preview of the client secret',
        examples: ['***c9x2']
      }),
      secret: v.nullable(
        v.string({
          name: 'secret',
          description: 'Full client secret value, only returned when created',
          examples: ['mt_oauth_secret2n0f9x8c7v6b5m4l3k2j1h0g']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when this client secret was created'
      }),
      deleted_at: v.nullable(
        v.date({
          name: 'deleted_at',
          description: 'Timestamp when this client secret was deleted'
        })
      )
    }) as any
  )
  .build();
