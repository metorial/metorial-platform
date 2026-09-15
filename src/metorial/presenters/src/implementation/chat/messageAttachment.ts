import { v } from '@lowerdeck/validation';
import { getSignedFileDownloadUrl } from '@metorial/module-file';
import { Presenter } from '@metorial/presenter';
import { chatMessageAttachmentType } from '../../types';

export let v1ChatMessageAttachmentPresenter = Presenter.create(chatMessageAttachmentType)
  .presenter(async ({ chatMessageAttachment }) => ({
    object: 'chat.message_attachment' as const,

    id: chatMessageAttachment.id,
    provider_attachment_id: chatMessageAttachment.attachmentId,

    type: chatMessageAttachment.type,
    name: chatMessageAttachment.name,
    mime_type: chatMessageAttachment.mimeType,
    size: chatMessageAttachment.size,
    width: chatMessageAttachment.width,
    height: chatMessageAttachment.height,

    position: chatMessageAttachment.position,

    file_id: chatMessageAttachment.uploadedFileId ?? chatMessageAttachment.fileId,
    download_url:
      chatMessageAttachment.uploadedFile || chatMessageAttachment.file
        ? ((await getSignedFileDownloadUrl(
            chatMessageAttachment.uploadedFile ?? chatMessageAttachment.file!
          )) ?? null)
        : null,

    created_at: chatMessageAttachment.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('chat.message_attachment', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat message attachment identifier',
        examples: ['cma_3cDeFgHjKlMnPqRs']
      }),

      provider_attachment_id: v.nullable(
        v.string({
          name: 'provider_attachment_id',
          description: "The attachment's identifier on the chat provider",
          examples: ['F024BE7LH']
        })
      ),

      type: v.string({
        name: 'type',
        description: 'The kind of content the attachment holds',
        examples: ['image', 'file', 'video', 'audio']
      }),

      name: v.nullable(
        v.string({
          name: 'name',
          description: 'File name of the attachment',
          examples: ['invoice.pdf']
        })
      ),

      mime_type: v.nullable(
        v.string({
          name: 'mime_type',
          description: 'MIME type of the attachment',
          examples: ['application/pdf']
        })
      ),

      size: v.nullable(
        v.number({
          name: 'size',
          description: 'Size of the attachment in bytes',
          examples: [245760]
        })
      ),

      width: v.nullable(
        v.number({
          name: 'width',
          description: 'Width of the attachment in pixels, for visual attachments',
          examples: [1280]
        })
      ),

      height: v.nullable(
        v.number({
          name: 'height',
          description: 'Height of the attachment in pixels, for visual attachments',
          examples: [720]
        })
      ),

      position: v.number({
        name: 'position',
        description: 'Position of the attachment within its message, starting at zero',
        examples: [0]
      }),

      file_id: v.string({
        name: 'file_id',
        description: 'The Metorial file the attachment content is served through',
        examples: ['fil_9jKlMnPqRsTuVwXy']
      }),

      download_url: v.nullable(
        v.string({
          name: 'download_url',
          description:
            'Temporary URL the attachment content can be downloaded from. Null while the content is unavailable.',
          examples: [
            'https://download.metorial.com/files/fil_9jKlMnPqRsTuVwXy/8kLmNpQrStUvWxYz'
          ]
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the attachment was recorded',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
