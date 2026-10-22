import type {
  Slate,
  SlateAuthConfig,
  SlateAuthMethod,
  SlateInstanceOAuthSetup,
  SlateOAuthCredentials
} from '../../prisma/generated/client';
import { slateAuthConfigPresenter } from './slateAuthConfig';
import { slateOAuthCredentialsPresenter } from './slateOAuthCredentials';
import { presentSetupError, presentSetupUrl } from './slateOAuthSetupError';

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

  url: presentSetupUrl(setup),

  error: presentSetupError(setup),
  adminInstructions: setup.adminInstructions,

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
