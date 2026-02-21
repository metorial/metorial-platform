import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { customServerCodeEditorTokenType } from '../../types';

export let v1CustomServerCodeEditorTokenPresenter = Presenter.create(
  customServerCodeEditorTokenType
)
  .presenter(async ({ id, token, expiresAt }) => ({
    object: 'custom_server.code_editor_token' as const,
    id,
    token,
    expires_at: expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_server.code_editor_token', {
        description: "String representing the object's type"
      }),
      id: v.string({ description: 'The code bucket ID' }),
      token: v.string({ description: 'The code editor access token URL' }),
      expires_at: v.date({ description: 'When the token expires' })
    })
  )
  .build();
