import type {
  Slate,
  SlateOAuthCredentials,
  SlateOAuthCredentialsTemplate
} from '@mtsrc/slates-hub-db/client';

export let slateOAuthCredentialsPresenter = (
  creds: SlateOAuthCredentials & {
    slate: Slate;
    template?: SlateOAuthCredentialsTemplate | null;
  }
) => ({
  object: 'slate.oauth_credentials',

  id: creds.id,
  slateId: creds.slate.id,

  clientId: creds.clientId,
  // clientSecret: inst.clientSecret,
  scopes: creds.scopes,

  authMethodKey: creds.authMethodKey,
  fixedInput: creds.fixedInput ?? {},
  templateId: creds.template?.id ?? null,
  templateVersion: creds.templateVersion,
  templateSecretVersion: creds.templateSecretVersion,

  createdAt: creds.createdAt,
  updatedAt: creds.updatedAt
});
