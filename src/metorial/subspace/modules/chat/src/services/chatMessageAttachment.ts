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
import type { File } from '@metorial/db';
import { fileService } from '@metorial/module-file';
import { toDownloadInput } from '@slates/adapter-chat';
import { chatAdapterService } from '../internal/chatAdapter';
import { assertChatCapability } from '../lib/chatCapability';
import { unwrapChatCall } from '../lib/chatError';
import { type ChatWithProvider } from './chatChannel';

export let chatMessageAttachmentDelegatorKey = 'subspace-chat-message-attachment';

export type DownloadChatMessageAttachmentParams = {
  chat: ChatWithProvider;
  message: ChatMessage;
  attachment: AttachmentRef;
  position?: number;
};

export type AttachUploadedChatMessageAttachmentParams = {
  message: ChatMessage;
  attachment: AttachmentRef;
  uploadedFile: Pick<File, 'id'>;
  position?: number;
};

export type ChatMessageAttachmentWithToolCallAttachment = ChatMessageAttachment & {
  toolCallAttachment: ToolCallAttachment | null;
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

class chatMessageAttachmentServiceImpl {
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

  private async createDelegatedFileForAttachment(d: {
    environment: Environment;
    chatMessageAttachmentId: string;
    ref: AttachmentRef;
  }) {
    if (!d.environment.instanceOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Chat environment is not linked to an instance; cannot store attachments.'
        })
      );
    }

    let file = await fileService.createDelegatedFile({
      instance: { oid: d.environment.instanceOid },
      purpose: 'generic',
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

  async downloadChatMessageAttachment(
    d: { tenant: Tenant; environment: Environment } & DownloadChatMessageAttachmentParams
  ): Promise<ChatMessageAttachment> {
    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });
    assertFileDownloadCapability(client);

    let downloaded = await client.call(
      'metorial_chat$file.download',
      toDownloadInput(d.attachment)
    );
    let result = unwrapChatCall(downloaded, {
      code: 'chat_attachment_download_failed',
      message: 'Failed to download the attachment from the chat provider.'
    }) as DownloadFileResult;

    let toolCallAttachmentOid = await this.resolveToolCallAttachmentOid(result);
    if (!toolCallAttachmentOid) throw attachmentDownloadFailedError();

    let ids = getId('chatMessageAttachment');
    let fileId = await this.createDelegatedFileForAttachment({
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
    d: { environment: Environment } & AttachUploadedChatMessageAttachmentParams
  ): Promise<ChatMessageAttachment> {
    let ids = getId('chatMessageAttachment');
    let fileId = await this.createDelegatedFileForAttachment({
      environment: d.environment,
      chatMessageAttachmentId: ids.id,
      ref: d.attachment
    });

    return db.chatMessageAttachment.create({
      data: {
        ...ids,
        messageOid: d.message.oid,
        fileId,
        uploadedFileId: d.uploadedFile.id,
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
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });
    assertFileDownloadCapability(client);

    let downloaded = await client.call('metorial_chat$file.download', {
      providerFileReference: d.attachment.providerFileReference
    });
    let result = unwrapChatCall(downloaded, {
      code: 'chat_attachment_download_failed',
      message: 'Failed to re-download the attachment from the chat provider.'
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
}

export let chatMessageAttachmentService = Service.create(
  'chatMessageAttachmentService',
  () => new chatMessageAttachmentServiceImpl()
).build();
