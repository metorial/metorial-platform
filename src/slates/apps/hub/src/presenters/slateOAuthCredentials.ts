import type { Slate, SlateOAuthCredentials } from '../../prisma/generated/client';

export let slateOAuthCredentialsPresenter = (
  creds: SlateOAuthCredentials & {
    slate: Slate;
  }
) => ({
  object: 'slate.oauth_credentials',

  id: creds.id,
  slateId: creds.slate.id,

  clientId: creds.clientId,
  // clientSecret: inst.clientSecret,
  scopes: creds.scopes,

  createdAt: creds.createdAt,
  updatedAt: creds.updatedAt
});
