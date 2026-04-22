import type {
  SlateInstanceOAuthSetup,
  SlateInstanceOAuthSetupEvent,
  SlateInvocation
} from '../../prisma/generated/client';
import { slateInvocationLitePresenter } from './slateInvocation';

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
  invocation: event.invocation ? await slateInvocationLitePresenter(event.invocation) : null,
  createdAt: event.createdAt
});
