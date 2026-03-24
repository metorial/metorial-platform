import type {
  Slate,
  SlateAuthConfig,
  SlateAuthMethod,
  SlateInstanceOAuthSetup,
  SlateOAuthCredentials
} from '../../prisma/generated/client';
import { env } from '../env';
import { slateAuthConfigPresenter } from './slateAuthConfig';
import { slateOAuthCredentialsPresenter } from './slateOAuthCredentials';

export let slateInstanceOAuthSetupPresenter = (
  setup: SlateInstanceOAuthSetup & {
    slate: Slate;
    oauthCredentials: SlateOAuthCredentials;
    slateAuthConfig: (SlateAuthConfig & { authMethod: SlateAuthMethod }) | null;
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

  createdAt: setup.createdAt,
  updatedAt: setup.updatedAt
});
