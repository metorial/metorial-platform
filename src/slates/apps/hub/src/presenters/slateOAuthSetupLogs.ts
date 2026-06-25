import { shadowId } from '@lowerdeck/shadow-id';
import type {
  Slate,
  SlateAuthConfig,
  SlateAuthMethod,
  SlateInstanceOAuthSetup,
  SlateInstanceOAuthSetupEvent,
  SlateInvocation,
  SlateOAuthCredentials
} from '../../prisma/generated/client';
import { env } from '../env';
import { slateInvocationLitePresenter } from './slateInvocation';
import { slateAuthConfigPresenter } from './slateAuthConfig';
import { slateOAuthCredentialsPresenter } from './slateOAuthCredentials';

export let slateInstanceOAuthSetupLogsPresenter = async (
  setup: SlateInstanceOAuthSetup & {
    slate: Slate;
    oauthCredentials: SlateOAuthCredentials;
    slateAuthConfig: (SlateAuthConfig & { authMethod: SlateAuthMethod }) | null;
    events: (SlateInstanceOAuthSetupEvent & {
      invocation: SlateInvocation | null;
    })[];
  }
) => ({
  object: 'slate.oauth_setup',

  id: setup.id,
  slateId: setup.slate.id,
  status: setup.status,
  redirectUrl: setup.redirectUrl,
  url:
    setup.status === 'completed'
      ? null
      : `${env.service.SERVICE_PUBLIC_URL}/slates-hub/authorization?setup_id=${setup.id}`,

  error: setup.errorCode
    ? {
        code: setup.errorCode,
        message: setup.errorMessage ?? setup.errorCode
      }
    : null,

  credentials: slateOAuthCredentialsPresenter({
    ...setup.oauthCredentials,
    slate: setup.slate
  }),

  authConfig: setup.slateAuthConfig
    ? slateAuthConfigPresenter({
        ...setup.slateAuthConfig,
        slate: setup.slate,
        oauthCredentials: setup.oauthCredentials
      })
    : null,

  events: await Promise.all(
    setup.events.map(async inv => ({
      object: 'slate.oauth_setup.log',
      id: inv.id ?? shadowId('shsoxl_', [setup.id], [inv.oid]),
      type: inv.type,
      invocation: inv.invocation ? await slateInvocationLitePresenter(inv.invocation) : null,
      createdAt: inv.createdAt
    }))
  ),

  createdAt: setup.createdAt,
  updatedAt: setup.updatedAt
});
