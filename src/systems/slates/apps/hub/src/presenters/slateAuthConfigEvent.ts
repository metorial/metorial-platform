import { shadowId } from '@lowerdeck/shadow-id';
import type {
  SlateAttachment,
  SlateAuthConfig,
  SlateAuthConfigEvent,
  SlateAuthMethod,
  SlateInvocation
} from '../../prisma/generated/client';
import { slateInvocationLitePresenter } from './slateInvocation';

type InvocationWithStoredAttachments = SlateInvocation & {
  slateInvocationAttachment?: Array<{
    attachments: SlateAttachment;
  }>;
};

export let slateAuthConfigEventPresenter = async (
  event: SlateAuthConfigEvent & {
    config: SlateAuthConfig & {
      authMethod: SlateAuthMethod;
    };
    invocation: InvocationWithStoredAttachments | null;
  }
) => ({
  object: 'slate.auth_config.event',

  id: shadowId('shace_', [event.config.id], [event.oid]),
  type: event.type,
  authConfigId: event.config.id,
  authMethodKey: event.config.authMethod.key,

  invocation: event.invocation ? await slateInvocationLitePresenter(event.invocation) : null,

  createdAt: event.createdAt
});
