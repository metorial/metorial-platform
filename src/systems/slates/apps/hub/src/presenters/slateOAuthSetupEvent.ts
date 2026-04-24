import type {
  SlateInstanceOAuthSetup,
  SlateInstanceOAuthSetupEvent,
  SlateInvocation
} from '../../prisma/generated/client';
import { slateInvocationLitePresenter } from './slateInvocation';

let getEventError = (event: {
  type: SlateInstanceOAuthSetupEvent['type'];
  setup: SlateInstanceOAuthSetup;
}) => {
  if (event.type !== 'oauth_setup_failed') return null;

  let code = event.setup.errorCode ?? 'oauth_setup_failed';
  let message = event.setup.errorMessage ?? 'OAuth setup failed.';
  return { code, message };
};

export let slateOAuthSetupEventPresenter = async (
  event: SlateInstanceOAuthSetupEvent & {
    setup: SlateInstanceOAuthSetup;
    invocation: SlateInvocation | null;
  }
) => ({
  object: 'slate.oauth_setup.event',

  id: event.id ?? String(event.oid),
  type: event.type,
  slateOAuthSetupId: event.setup.id,
  error: getEventError(event),
  invocation: event.invocation ? await slateInvocationLitePresenter(event.invocation) : null,
  createdAt: event.createdAt
});
