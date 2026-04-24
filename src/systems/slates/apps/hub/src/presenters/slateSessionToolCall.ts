import type { SlateAction } from '../../prisma/generated/browser';
import type {
  SlateAttachment,
  SlateInvocation,
  SlateSession,
  SlateSessionToolCall,
  SlateVersion
} from '../../prisma/generated/client';
import { slateInvocationAttachmentsPresenter } from './slateAttachment';
import { slateInvocationLitePresenter } from './slateInvocation';

type InvocationWithStoredAttachments = SlateInvocation & {
  slateInvocationAttachment?: Array<{
    attachments: SlateAttachment;
  }>;
};

export let slateSessionToolCallPresenter = async (
  call: SlateSessionToolCall & {
    action: SlateAction;
    invocation: InvocationWithStoredAttachments;
    session: SlateSession;
    slateVersion: SlateVersion;
  }
) => {
  return {
    object: 'slate.session.tool_call',

    id: call.id,
    status: call.status,
    sessionId: call.session.id,
    slateVersionId: call.slateVersion.id,

    error: call.errorCode
      ? {
          code: call.errorCode,
          message: call.errorMessage ?? call.errorCode
        }
      : null,
    durationMs: call.durationMs,

    action: {
      object: 'slate.au',

      id: call.action.id,
      key: call.action.key,
      name: call.action.name
    },

    attachments: await slateInvocationAttachmentsPresenter(call.invocation),
    createdAt: call.createdAt
  };
};

export let slateSessionToolCallLogsPresenter = async (
  call: SlateSessionToolCall & {
    action: SlateAction;
    invocation: InvocationWithStoredAttachments;
    session: SlateSession;
    slateVersion: SlateVersion;
  }
) => {
  return {
    object: 'slate.session.tool_call',

    id: call.id,
    status: call.status,
    sessionId: call.session.id,
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
