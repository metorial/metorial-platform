import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { documentEditTokenType } from '../../types';

export let v1DocumentEditTokenPresenter = Presenter.create(documentEditTokenType)
  .presenter(async ({ token }) => ({
    object: 'document.edit_token',
    token: token.token,
    expires_at: token.expiresAt,
    document_id: token.documentId
  }))
  .schema(
    v.object({
      object: v.literal('document.edit_token', {
        description: 'String representing the object’s type.'
      }),
      token: v.string({ description: 'Token for establishing a live document session.' }),
      expires_at: v.date({ description: 'When the token stops working.' }),
      document_id: v.string({ description: 'Document the token grants access to.' })
    })
  )
  .build();
