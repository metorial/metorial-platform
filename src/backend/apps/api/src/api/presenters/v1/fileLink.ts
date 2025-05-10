import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { fileLinkType } from '../types';

export let v1FileLinkPresenter = Presenter.create(fileLinkType)
  .presenter(async ({ fileLink }, opts) => ({
    id: fileLink.id,
    file_id: fileLink.file.id,

    url: `${getConfig().urls.apiUrl}/files/view/${fileLink.id}/${fileLink.key}`,

    created_at: fileLink.createdAt,
    expires_at: fileLink.expiresAt
  }))
  .schema(
    v.object({
      id: v.string({ name: 'id', description: `The links's unique identifier` }),
      file_id: v.string({
        name: 'file_id',
        description: `The file's unique identifier`
      }),
      url: v.string({
        name: 'url',
        description: `The file's public URL`,
        examples: ['https://api.metorial.com/files/view/1234567890/abcdefg']
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
