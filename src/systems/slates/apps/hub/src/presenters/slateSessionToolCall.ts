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
    sessionId: call.session.id,
    slateVersionId: call.slateVersion.id,

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
    sessionId: call.session.id,
    slateVersionId: call.slateVersion.id,

    action: {
      object: 'slate.au',

      id: call.action.id,
      key: call.action.key,
      name: call.action.name
    },

    attachments: await slateInvocationAttachmentsPresenter(call.invocation),
    invocation: await slateInvocationLitePresenter(call.invocation),

    createdAt: call.createdAt
  };
};
