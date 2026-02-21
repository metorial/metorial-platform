import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { bucketEditorTokenType } from '../../types';

export let v1BucketEditorTokenPresenter = Presenter.create(bucketEditorTokenType)
  .presenter(async ({ id, token, expiresAt }) => ({
    object: 'bucket.editor_token' as const,
    id,
    token,
    expires_at: expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('bucket.editor_token', {
        description: "String representing the object's type"
      }),
      id: v.string({ description: 'The code bucket ID' }),
      token: v.string({ description: 'The code editor access token URL' }),
      expires_at: v.string({ description: 'When the token expires' })
    })
  )
  .build();
