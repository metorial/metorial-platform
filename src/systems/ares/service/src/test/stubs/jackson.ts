export let jackson = {
  apiController: {},
  oauthController: {},
  redirectUrl: 'http://ares-sso.test/*',
  defaultRedirectUrl: {
    saml: 'http://ares-sso.test/sso/jxn/saml/callback',
    oidc: 'http://ares-sso.test/sso/jxn/oidc/callback'
  }
};
