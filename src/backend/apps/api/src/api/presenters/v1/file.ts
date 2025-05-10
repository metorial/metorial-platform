import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { fileType } from '../types';

export let v1FilePresenter = Presenter.create(fileType)
  .presenter(async ({ file }, opts) => ({
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
      id: v.string({ name: 'id', description: `The files's unique identifier` }),
      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: `The files's status`
      }),
      file_name: v.string({
        name: 'file_name',
        description: `The file's name`,
        examples: ['sample.png']
      }),
      file_size: v.number({
        name: 'file_size',
        description: `The file's size in bytes`,
        examples: [123456]
      }),
      file_type: v.string({
        name: 'file_type',
        description: `The file's MIME type`,
        examples: ['image/png']
      }),
      title: v.nullable(
        v.string({
          name: 'title',
          description: `The file's title`,
          examples: ['Sample Image']
        })
      ),
      purpose: v.object({
        name: v.string({
          name: 'name',
          description: `The file's purpose name`,
          examples: ['User Image']
        }),
        identifier: v.string({
          name: 'identifier',
          description: `The file's purpose identifier`,
          examples: ['files_image']
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
