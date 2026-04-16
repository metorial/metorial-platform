import type {
  Slate,
  SlateAuthConfig,
  SlateAuthMethod,
  SlateOAuthCredentials
} from '../../prisma/generated/client';
import { slateAuthMethodPresenter } from './slateAuthMethod';
import { slateOAuthCredentialsPresenter } from './slateOAuthCredentials';

export let slateAuthConfigPresenter = (
  config: SlateAuthConfig & {
    slate: Slate;
    oauthCredentials: SlateOAuthCredentials | null;
    authMethod: SlateAuthMethod;
  }
) => ({
  object: 'slate.auth_config',

  id: config.id,
  slateId: config.slate.id,
  status: config.errorCode
    ? ('failed' as const)
    : config.isProcessing
      ? ('processing' as const)
      : ('active' as const),

  error: config.errorCode
    ? {
        code: config.errorCode,
        message: config.errorMessage ?? config.errorCode,
        invocationId: config.errorInvocationId ?? null
      }
    : null,

  profile: config.profile
    ? {
        id: config.profileUid,
        email: config.profileEmail,
        name: config.profileName,
        data: config.profile
      }
    : null,

  authMethod: slateAuthMethodPresenter({
    ...config.authMethod,
    slate: config.slate
  }),

  oauthCredentials: config.oauthCredentials
    ? slateOAuthCredentialsPresenter({
        ...config.oauthCredentials,
        slate: config.slate
      })
    : null,

  tokenExpiresAt: config.tokenExpiresAt,

  createdAt: config.createdAt,
  updatedAt: config.updatedAt
});
