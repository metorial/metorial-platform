import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { type AttachmentRef, type ChatAdapterInstance } from '@metorial-subspace/adapter-chat';
import {
  type ChatMessage,
  type ChatMessageAttachment,
  db,
  type Environment,
  getId,
  type Tenant,
  type ToolCallAttachment
} from '@metorial-subspace/db';
import { createSystemAuditScope } from '@metorial/audit-scope';
import { db as coreDb, type File } from '@metorial/db';
import {
  chatMessageAttachmentFilePurposeSlug,
  fileLinkService,
  fileReferenceService,
  fileService
} from '@metorial/module-file';
import { toDownloadInput } from '@slates/adapter-chat';
import { assertChatCapability } from '../lib/chatCapability';
import { unwrapChatCall } from '../lib/chatError';
import { type ChatWithProvider } from '../services/chatChannel';
import { chatAdapterService } from './chatAdapter';

export let chatMessageAttachmentDelegatorKey = 'subspace-chat-message-attachment';

export let chatMessageAttachmentFileReferenceEntityType = 'chat_message_attachment';

export type DownloadChatMessageAttachmentParams = {
  chat: ChatWithProvider;
  message: ChatMessage;
  attachment: AttachmentRef;
  position?: number;
};

export type AttachUploadedChatMessageAttachmentParams = {
  message: ChatMessage;
  attachment: AttachmentRef;
  uploadedFile: Pick<File, 'id' | 'oid'> & { purpose: { canHaveLinks: boolean } };
  position?: number;
};

export type ChatMessageAttachmentWithToolCallAttachment = ChatMessageAttachment & {
  toolCallAttachment: ToolCallAttachment | null;
};

export type HydratedChatMessageAttachment<
  T extends ChatMessageAttachment = ChatMessageAttachment
> = T & {
  file: File | null;
  uploadedFile: File | null;
};

type DownloadFileResult = {
  attachment: AttachmentRef;
  raw?: unknown;
  $attachments?: Array<{ id: string; type: 'url'; url: string; mimeType?: string }>;
};

let assertFileDownloadCapability = (client: ChatAdapterInstance) =>
  assertChatCapability(client, 'file_download', {
    message: 'This chat provider does not support downloading files.'
  });

let attachmentDownloadFailedError = () =>
  new ServiceError(
    badRequestError({
      code: 'chat_attachment_download_failed',
      message: 'The chat provider did not return downloadable attachment content.'
    })
  );

class chatMessageAttachmentInternalServiceImpl {
  private attachmentPayload(ref: AttachmentRef) {
    return {
      type: ref.type,
      name: ref.name,
      mimeType: ref.mimeType,
      size: ref.size,
      width: ref.width,
      height: ref.height,
      attachmentId: ref.id,
      clientReferenceId: ref.clientReferenceId ?? null,
      providerFileReference: (ref.providerFileReference as any) ?? null,
      raw: (ref.raw as any) ?? null
    };
  }

  private async resolveToolCallAttachmentOid(result: DownloadFileResult) {
    let presented = result.$attachments?.[0];
    if (!presented) return null;

    let toolCallAttachment = await db.toolCallAttachment.findUnique({
      where: { id: presented.id }
    });
    return toolCallAttachment?.oid ?? null;
  }

  private requireStorageScope(d: { tenant: Tenant; environment: Environment }) {
    if (!d.environment.instanceOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Chat environment is not linked to an instance; cannot store attachments.'
        })
      );
    }
    if (!d.tenant.projectOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Chat tenant is not linked to a project; cannot store attachments.'
        })
      );
    }

    return {
      project: { oid: d.tenant.projectOid },
      instance: { oid: d.environment.instanceOid }
    };
  }

  private async createDelegatedFileForAttachment(d: {
    tenant: Tenant;
    environment: Environment;
    chatMessageAttachmentId: string;
    ref: AttachmentRef;
  }) {
    let scope = this.requireStorageScope(d);

    let file = await fileService.createDelegatedFile({
      ...scope,
      purpose: chatMessageAttachmentFilePurposeSlug,
      delegatorKey: chatMessageAttachmentDelegatorKey,
      delegatorRef: { chatMessageAttachmentId: d.chatMessageAttachmentId },
      input: {
        name: d.ref.name ?? 'attachment',
        mimeType: d.ref.mimeType ?? 'application/octet-stream',
        size: d.ref.size ?? 0
      }
    });

    return file.id;
  }

  private async createUploadedFileReference(d: {
    tenant: Tenant;
    environment: Environment;
    chatMessageAttachmentId: string;
    uploadedFile: AttachUploadedChatMessageAttachmentParams['uploadedFile'];
  }) {
    let scope = this.requireStorageScope(d);

    let link = await fileLinkService.createFileLink({
      ...scope,
      file: d.uploadedFile,
      input: {}
    });

    let reference = await fileReferenceService.upsertFileReference({
      ...scope,
      fileLink: link,
      input: {
        entityType: chatMessageAttachmentFileReferenceEntityType,
        entityId: d.chatMessageAttachmentId
      }
    });

    return reference.id;
  }

  async downloadChatMessageAttachment(
    d: { tenant: Tenant; environment: Environment } & DownloadChatMessageAttachmentParams
  ): Promise<ChatMessageAttachment> {
    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatInstanceProvider: d.chat.chatInstanceProvider
    });
    assertFileDownloadCapability(client);

    let downloaded = await client.call(
      'metorial_chat$file.download',
      toDownloadInput(d.attachment)
    );
    let result = unwrapChatCall(downloaded, {
      code: 'chat_attachment_download_failed',
      message: 'Failed to download the attachment from the chat provider.',
      invocation: {
        operation: 'file.download',
        chatInstanceProvider: d.chat.chatInstanceProvider,
        chat: d.chat
      }
    }) as DownloadFileResult;

    let toolCallAttachmentOid = await this.resolveToolCallAttachmentOid(result);
    if (!toolCallAttachmentOid) throw attachmentDownloadFailedError();

    let ids = getId('chatMessageAttachment');
    let fileId = await this.createDelegatedFileForAttachment({
      tenant: d.tenant,
      environment: d.environment,
      chatMessageAttachmentId: ids.id,
      ref: result.attachment
    });

    return db.chatMessageAttachment.create({
      data: {
        ...ids,
        messageOid: d.message.oid,
        toolCallAttachmentOid,
        fileId,
        position: d.position ?? 0,
        ...this.attachmentPayload(result.attachment)
      }
    });
  }

  async attachUploadedFile(
    d: { tenant: Tenant; environment: Environment } & AttachUploadedChatMessageAttachmentParams
  ): Promise<ChatMessageAttachment> {
    let ids = getId('chatMessageAttachment');
    let fileId = await this.createDelegatedFileForAttachment({
      tenant: d.tenant,
      environment: d.environment,
      chatMessageAttachmentId: ids.id,
      ref: d.attachment
    });
    let uploadedFileReferenceId = await this.createUploadedFileReference({
      tenant: d.tenant,
      environment: d.environment,
      chatMessageAttachmentId: ids.id,
      uploadedFile: d.uploadedFile
    });

    return db.chatMessageAttachment.create({
      data: {
        ...ids,
        messageOid: d.message.oid,
        fileId,
        uploadedFileId: d.uploadedFile.id,
        uploadedFileReferenceId,
        position: d.position ?? 0,
        ...this.attachmentPayload(d.attachment)
      }
    });
  }

  async ensureFreshChatMessageAttachment(d: {
    tenant: Tenant;
    environment: Environment;
    chat: ChatWithProvider;
    attachment: ChatMessageAttachmentWithToolCallAttachment;
  }): Promise<ChatMessageAttachmentWithToolCallAttachment> {
    let { toolCallAttachment } = d.attachment;
    let isFresh =
      !!toolCallAttachment &&
      (!toolCallAttachment.expiresAt || toolCallAttachment.expiresAt > new Date());
    if (isFresh) return d.attachment;

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatInstanceProvider: d.chat.chatInstanceProvider
    });
    assertFileDownloadCapability(client);

    let downloaded = await client.call('metorial_chat$file.download', {
      providerFileReference: d.attachment.providerFileReference
    });
    let result = unwrapChatCall(downloaded, {
      code: 'chat_attachment_download_failed',
      message: 'Failed to re-download the attachment from the chat provider.',
      invocation: {
        operation: 'file.download',
        chatInstanceProvider: d.chat.chatInstanceProvider,
        chat: d.chat
      }
    }) as DownloadFileResult;

    let toolCallAttachmentOid = await this.resolveToolCallAttachmentOid(result);
    if (!toolCallAttachmentOid) throw attachmentDownloadFailedError();

    let freshToolCallAttachment = await db.toolCallAttachment.findUniqueOrThrow({
      where: { oid: toolCallAttachmentOid }
    });

    let updated = await db.chatMessageAttachment.update({
      where: { oid: d.attachment.oid },
      data: { toolCallAttachmentOid }
    });

    return { ...updated, toolCallAttachment: freshToolCallAttachment };
  }

  async cleanupAttachmentFiles(d: {
    fileId: string;
    uploadedFileId?: string | null;
    uploadedFileReferenceId?: string | null;
  }) {
    if (d.uploadedFileReferenceId) {
      await fileReferenceService.deleteFileReferenceByIdAndCleanup({
        fileReferenceId: d.uploadedFileReferenceId
      });
    }

    if (d.uploadedFileId) {
      let uploadedFile = await coreDb.file.findFirst({
        where: { id: d.uploadedFileId, status: 'active' },
        include: { instance: true }
      });
      if (uploadedFile && !uploadedFile.isReadOnly) {
        let hasRefs = await fileReferenceService.hasReferencesForFile({ file: uploadedFile });
        if (!hasRefs) {
          if (!uploadedFile.instance) {
            throw new Error(`Chat attachment file ${uploadedFile.id} is not instance-owned`);
          }

          await fileService.deleteFile({
            file: uploadedFile,
            auditScope: createSystemAuditScope({
              organization: { oid: uploadedFile.instance.organizationOid },
              instance: uploadedFile.instance,
              job: 'chat/attachment/cleanup'
            })
          });
        }
      }
    }

    let delegatedFile = await coreDb.file.findFirst({
      where: { id: d.fileId, status: 'active' }
    });
    if (delegatedFile) {
      await fileService.deleteDelegatedFile({ file: delegatedFile });
    }
  }

  async hydrateChatMessageAttachments<T extends ChatMessageAttachment>(
    attachments: T[]
  ): Promise<HydratedChatMessageAttachment<T>[]> {
    if (!attachments.length) return [];

    let fileIds = [
      ...new Set(
        attachments
          .flatMap(attachment => [attachment.fileId, attachment.uploadedFileId])
          .filter((id): id is string => !!id)
      )
    ];
    let files = fileIds.length
      ? await coreDb.file.findMany({ where: { id: { in: fileIds } } })
      : [];
    let fileById = new Map(files.map(file => [file.id, file]));

    return attachments.map(attachment => ({
      ...attachment,
      file: fileById.get(attachment.fileId) ?? null,
      uploadedFile: attachment.uploadedFileId
        ? (fileById.get(attachment.uploadedFileId) ?? null)
        : null
    }));
  }

  async hydrateChatMessageAttachment<T extends ChatMessageAttachment>(
    attachment: T
  ): Promise<HydratedChatMessageAttachment<T>> {
    let [hydrated] = await this.hydrateChatMessageAttachments([attachment]);
    return hydrated!;
  }
}

export let chatMessageAttachmentInternalService = Service.create(
  'chatMessageAttachmentInternalService',
  () => new chatMessageAttachmentInternalServiceImpl()
).build();
