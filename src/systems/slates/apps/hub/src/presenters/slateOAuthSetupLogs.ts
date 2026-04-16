import { shadowId } from '@lowerdeck/shadow-id';
import type {
  Slate,
  SlateInstanceOAuthSetup,
  SlateInstanceOAuthSetupEvent,
  SlateInvocation,
  SlateOAuthCredentials
} from '../../prisma/generated/client';
import { slateInvocationLitePresenter } from './slateInvocation';

export let slateInstanceOAuthSetupLogsPresenter = async (
  setup: SlateInstanceOAuthSetup & {
    slate: Slate;
    oauthCredentials: SlateOAuthCredentials;
    events: (SlateInstanceOAuthSetupEvent & {
      invocation: SlateInvocation | null;
    })[];
  }
) => ({
  object: 'slate.oauth_setup',

  id: setup.id,
  slateId: setup.slate.id,

  error: setup.errorCode
    ? {
        code: setup.errorCode,
        message: setup.errorMessage ?? setup.errorCode
      }
    : null,

  events: await Promise.all(
    setup.events.map(async inv => ({
      object: 'slate.oauth_setup.log',
      id: inv.id ?? shadowId('shsoxl_', [setup.id], [inv.oid]),
      type: inv.type,
      invocation: inv.invocation ? await slateInvocationLitePresenter(inv.invocation) : null,
      createdAt: inv.createdAt
    }))
  )
});
