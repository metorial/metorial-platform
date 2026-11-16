import { v } from '@lowerdeck/validation';
import { OAuthApplication, OAuthApplicationClientSecret, Organization } from '@metorial/db';
import { oauthApplicationPresenter } from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let oauthApplicationResource = resource({
  name: 'oauth_application',
  payload: v.typedAny<{
    oauthApplication: OAuthApplication & {
      organization: Organization | null;
      clientSecrets?: OAuthApplicationClientSecret[] | null;
    };
  }>('oauth_application'),
  presenter: oauthApplicationPresenter,
  actions: {
    create: true,
    update: true,
    archive: true
  }
});

export let oauthApplicationClientSecretResource = resource({
  name: 'oauth_application_client_secret',
  payload: v.typedAny<{
    id: string;
    secretPreview: string;
    oauthApplication: { id: string; name: string };
  }>('oauth_application_client_secret'),
  presenter: undefined,
  actions: {
    create: true,
    delete: true
  }
});
