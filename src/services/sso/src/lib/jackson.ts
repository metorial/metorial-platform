import jack from '@boxyhq/saml-jackson';
import { env } from '../env';

let ret = await jack({
  noAnalytics: true,
  externalUrl: env.saml.SSO_SERVICE_HOST,
  samlPath: '/sso/jxn/saml/callback',
  oidcPath: '/sso/jxn/oidc/callback',
  samlAudience: env.saml.SSO_SERVICE_HOST,
  db: {
    engine: 'mongo',
    url: env.jackson.SSO_MONGO_URL
  },
  idpEnabled: true // to allow folks to SSO directly from their IDP
  // scimPath: '/sso/jxn/scim/v2.0',
});

export let jackson = {
  apiController: ret.apiController,
  oauthController: ret.oauthController,

  redirectUrl: `${env.saml.SSO_SERVICE_HOST}/*`,
  defaultRedirectUrl: {
    saml: `${env.saml.SSO_SERVICE_HOST}/sso/jxn/saml/callback`,
    oidc: `${env.saml.SSO_SERVICE_HOST}/sso/jxn/oidc/callback`
  }
  // directorySyncController: ret.directorySyncController
};
