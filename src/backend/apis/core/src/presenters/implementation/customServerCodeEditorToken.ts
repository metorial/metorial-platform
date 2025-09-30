import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { customServerCodeEditorTokenType } from '../types';

export let v1CustomServerCodeEditorTokenPresenter = Presenter.create(
  customServerCodeEditorTokenType
)
  .presenter(async ({ id, token, expiresAt }, opts) => ({
    object: 'custom_server.code_editor_token',

    id,
    token,
    expires_at: expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_server.code_editor_token'),

      id: v.string({
        description: 'ID of the code bucket',
        name: 'id'
      }),
      token: v.string({
        description: 'Token to access the code editor',
        name: 'token'
      }),
      expires_at: v.date({
        description: 'Expiration date of the token',
        name: 'expires_at'
      })
    })
  )
  .build();
