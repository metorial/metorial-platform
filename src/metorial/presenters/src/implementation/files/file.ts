import { v } from '@lowerdeck/validation';
import { getSignedFileDownloadUrl } from '@metorial/module-file';
import { Presenter } from '@metorial/presenter';
import { fileType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from './documentParticipant';

export let v1FilePresenter = Presenter.create(fileType)
  .presenter(async ({ file }, opts) => ({
    object: 'file',

    id: file.id,
    status: file.status,

    file_name: file.fileName,
    file_size: Number(file.fileSize),
    file_type: file.fileType,

    title: file.title,

    purpose: file.purpose.slug,
    created_by: file.createdByResourceActor
      ? await presentDocumentParticipantActor(file.createdByResourceActor, opts)
      : null,

    created_at: file.createdAt,
    updated_at: file.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('file', { description: 'String representing the object’s type.' }),

      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['fil_9jKlMnPqRsTuVwXy']
      }),
      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: '`deleted` after the file is deleted.'
      }),
      file_name: v.string({
        name: 'file_name',
        description: 'Name of the uploaded file.',
        examples: ['company-logo.png']
      }),
      file_size: v.number({
        name: 'file_size',
        description: 'Size of the file in bytes.',
        examples: [245760]
      }),
      file_type: v.string({
        name: 'file_type',
        description: 'MIME type of the file.',
        examples: ['image/png']
      }),
      title: v.string({
        name: 'title',
        description: 'Label shown for the file.',
        examples: ['Company Logo']
      }),
      purpose: v.string({
        name: 'identifier',
        description: 'Why the file was uploaded. Controls what it can be used for.',
        examples: ['organization_logo']
      }),
      created_by: v.nullable(documentParticipantActorSchema, {
        description: 'Actor that uploaded the file.'
      }),
      created_at: v.date({ name: 'created_at', description: 'Creation time.' }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.'
      })
    })
  )
  .build();

export let dashboardFilePresenter = Presenter.create(fileType)
  .presenter(async ({ file }, opts) => {
    let inner = await v1FilePresenter.present({ file }, opts).run();

    return {
      ...inner,
      download_url: (await getSignedFileDownloadUrl(file)) ?? null
    };
  })
  .schema(
    v.intersection([
      v1FilePresenter.schema,
      v.object({
        download_url: v.nullable(
          v.string({ description: 'Signed download URL for the file.' })
        )
      })
    ])
  )
  .build();
