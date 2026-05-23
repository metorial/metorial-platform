import { shadowId } from '@mtsrc/shadow-id';
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

let getEventError = (event: {
  type: SlateAuthConfigEvent['type'];
  config: SlateAuthConfig;
}) => {
  if (event.type !== 'oauth_token_refresh_failed') return null;

  let code = event.config.errorCode ?? 'oauth_token_refresh_failed';
  let message =
    event.config.errorMessage ?? 'Failed to refresh the OAuth authentication token.';
  return { code, message };
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

  id: event.id ?? shadowId('shace_', [event.config.id], [event.oid]),
  type: event.type,
  authConfigId: event.config.id,
  authMethodKey: event.config.authMethod.key,
  error: getEventError(event),

  invocation: event.invocation ? await slateInvocationLitePresenter(event.invocation) : null,

  createdAt: event.createdAt
});
