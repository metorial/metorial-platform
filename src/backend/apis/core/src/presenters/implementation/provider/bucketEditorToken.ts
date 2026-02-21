import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { bucketEditorTokenType } from '../../types';

export let v1BucketEditorTokenPresenter = Presenter.create(bucketEditorTokenType)
  .presenter(async ({ token }) => ({
    object: 'bucket.editor_token' as const,
    id: token.id,
    url: token.url,
    expires_at: token.expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('bucket.editor_token', {
        description: "String representing the object's type"
      }),
      id: v.string({ description: 'The code bucket ID' }),
      url: v.string({ description: 'The code editor URL' }),
      expires_at: v.date({ description: 'When the token expires' })
    })
  )
  .build();
