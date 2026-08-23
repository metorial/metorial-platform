import type { SlateAction } from '../../prisma/generated/browser';
import type {
  Slate,
  SlateAttachment,
  SlateInvocation,
  SlatePublicToolCall,
  SlateVersion
} from '../../prisma/generated/client';
import { slateInvocationAttachmentsPresenter } from './slateAttachment';
import { slateInvocationLitePresenter } from './slateInvocation';

type InvocationWithStoredAttachments = SlateInvocation & {
  slateInvocationAttachment?: Array<{
    attachments: SlateAttachment;
  }>;
};

export let slatePublicToolCallPresenter = async (
  call: SlatePublicToolCall & {
    action: SlateAction;
    invocation: InvocationWithStoredAttachments;
    slate: Slate;
    slateVersion: SlateVersion;
  }
) => {
  return {
    object: 'slate.public_tool_call',

    id: call.id,
    status: call.status,
    slateId: call.slate.id,
    slateVersionId: call.slateVersion.id,

    error: call.errorCode
      ? {
          code: call.errorCode,
          message: call.errorMessage ?? call.errorCode
        }
      : null,
    durationMs: call.durationMs,

    action: {
      object: 'slate.action',

      id: call.action.id,
      key: call.action.key,
      name: call.action.name
    },

    attachments: await slateInvocationAttachmentsPresenter(call.invocation),
    createdAt: call.createdAt
  };
};

export let slatePublicToolCallLogsPresenter = async (
  call: SlatePublicToolCall & {
    action: SlateAction;
    invocation: InvocationWithStoredAttachments;
    slate: Slate;
    slateVersion: SlateVersion;
  }
) => {
  return {
    object: 'slate.public_tool_call',

    id: call.id,
    status: call.status,
    slateId: call.slate.id,
    slateVersionId: call.slateVersion.id,

    error: call.errorCode
      ? {
          code: call.errorCode,
          message: call.errorMessage ?? call.errorCode
        }
      : null,
    durationMs: call.durationMs,

    action: {
      object: 'slate.action',

      id: call.action.id,
      key: call.action.key,
      name: call.action.name
    },

    attachments: await slateInvocationAttachmentsPresenter(call.invocation),
    invocation: await slateInvocationLitePresenter(call.invocation),

    createdAt: call.createdAt
  };
};
