import type { SlateAction } from '../../prisma/generated/browser';
import type {
  SlateInvocation,
  SlateSession,
  SlateSessionToolCall,
  SlateVersion
} from '../../prisma/generated/client';
import { slateInvocationLitePresenter } from './slateInvocation';

export let slateSessionToolCallPresenter = (
  call: SlateSessionToolCall & {
    action: SlateAction;
    invocation: SlateInvocation;
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

    createdAt: call.createdAt
  };
};

export let slateSessionToolCallLogsPresenter = async (
  call: SlateSessionToolCall & {
    action: SlateAction;
    invocation: SlateInvocation;
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

    invocation: await slateInvocationLitePresenter(call.invocation),

    createdAt: call.createdAt
  };
};
