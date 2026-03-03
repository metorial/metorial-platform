import { Presenter } from '@lowerdeck/presenter';
import { v } from '@lowerdeck/validation';
import { getConfig } from '@metorial/config';
import { fileLinkType } from '../types';

export let v1FileLinkPresenter = Presenter.create(fileLinkType)
  .presenter(async ({ fileLink }, opts) => ({
    object: 'file.file_link',

    id: fileLink.id,
    file_id: fileLink.file.id,

    url: `${getConfig().urls.filesUrl}/files/retrieve/${fileLink.id}/${fileLink.key}`,

    created_at: fileLink.createdAt,
    expires_at: fileLink.expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('file.file_link', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The links's unique identifier`,
        examples: ['flk_5mNpQrStUvWxYzAb']
      }),
      file_id: v.string({
        name: 'file_id',
        description: `The file's unique identifier`,
        examples: ['fil_9jKlMnPqRsTuVwXy']
      }),
      url: v.string({
        name: 'url',
        description: `The file's public URL`,
        examples: ['https://files.metorial.com/files/retrieve/flk_5mNpQrStUvWxYzAb/a8f3k2m9']
      }),
      created_at: v.date({ name: 'created_at', description: `The links's creation date` }),
      expires_at: v.nullable(
        v.date({
          name: 'expires_at',
          description: `The file's expiration date`
        })
      )
    })
  )
  .build();
