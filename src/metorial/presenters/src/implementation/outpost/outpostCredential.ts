import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { outpostCredentialType } from '../../types';

export let v1OutpostCredentialPresenter = Presenter.create(outpostCredentialType)
  .presenter(async ({ outpost, credential, envelope }) => ({
    object: 'outpost_credential',

    id: credential.id,
    status: credential.status,

    outpost_id: outpost.id,
    name: credential.identifier,

    envelope_preview: credential.envelopePreview,
    envelope: envelope ?? null,

    expires_at: credential.expiresAt,
    created_at: credential.createdAt,
    updated_at: credential.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('outpost_credential', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The credential's unique identifier`,
        examples: ['otc_4fGhJkLmNpQrStUv']
      }),
      status: v.enumOf(['active', 'disabled', 'deleted', 'expired'], {
        name: 'status',
        description: `The credential's status`
      }),

      outpost_id: v.string({
        name: 'outpost_id',
        description: `The id of the outpost this credential belongs to`
      }),
      name: v.string({
        name: 'name',
        description: `The credential's name`,
        examples: ['CI Runner']
      }),

      envelope_preview: v.string({
        name: 'envelope_preview',
        description: `A non-secret preview of the credential envelope`,
        examples: ['metorial_op_fdhi...tz4u']
      }),
      envelope: v.nullable(
        v.string({
          name: 'envelope',
          description: `The full credential envelope. Only returned once, at creation time.`,
          examples: ['metorial_op_fdhiJkLmNpQrStUv...tz4u']
        })
      ),

      expires_at: v.nullable(
        v.date({
          name: 'expires_at',
          description: `The credential's expiration date`
        })
      ),
      created_at: v.date({ name: 'created_at', description: `The credential's creation date` }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The credential's last update date`
      })
    })
  )
  .build();
