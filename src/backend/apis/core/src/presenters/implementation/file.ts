import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { fileType } from '../types';

export let v1FilePresenter = Presenter.create(fileType)
  .presenter(async ({ file }, opts) => ({
    object: 'file',

    id: file.id,
    status: file.status,

    file_name: file.fileName,
    file_size: file.fileSize,
    file_type: file.fileType,

    title: file.title,

    purpose: {
      name: file.purpose.name,
      identifier: file.purpose.slug
    },

    created_at: file.createdAt,
    updated_at: file.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('file', { description: "String representing the object's type" }),

      id: v.string({
        name: 'id',
        description: `The files's unique identifier`,
        examples: ['fil_9jKlMnPqRsTuVwXy']
      }),
      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: `The files's status`
      }),
      file_name: v.string({
        name: 'file_name',
        description: `The file's name`,
        examples: ['company-logo.png']
      }),
      file_size: v.number({
        name: 'file_size',
        description: `The file's size in bytes`,
        examples: [245760]
      }),
      file_type: v.string({
        name: 'file_type',
        description: `The file's MIME type`,
        examples: ['image/png']
      }),
      title: v.string({
        name: 'title',
        description: `The file's title`,
        examples: ['Company Logo']
      }),
      purpose: v.object({
        name: v.string({
          name: 'name',
          description: `The file's purpose name`,
          examples: ['Organization Image']
        }),
        identifier: v.string({
          name: 'identifier',
          description: `The file's purpose identifier`,
          examples: ['organization_logo']
        })
      }),
      created_at: v.date({ name: 'created_at', description: `The files's creation date` }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The files's last update date`
      })
    })
  )
  .build();
