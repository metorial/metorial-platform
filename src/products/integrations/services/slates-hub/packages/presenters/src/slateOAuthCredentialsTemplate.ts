import type { Slate, SlateOAuthCredentialsTemplate } from '@mtsrc/slates-hub-db/client';
import { oauthCallbackUrl } from '@mtsrc/slates-hub-env/oauthCallbackUrl';

export let slateOAuthCredentialsTemplatePresenter = (
  template: SlateOAuthCredentialsTemplate & { slate: Slate }
) => ({
  object: 'slate.oauth_credentials_template',

  id: template.id,
  status: template.status,

  name: template.name,
  description: template.description,

  slateId: template.slate.id,
  authMethodKey: template.authMethodKey,
  fixedInput: template.fixedInput ?? {},

  clientId: template.clientId,
  scopes: template.scopes,

  callbackUrl: oauthCallbackUrl,

  version: template.version,
  secretVersion: template.secretVersion,

  archivedAt: template.archivedAt,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt
});
