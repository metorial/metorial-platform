import { vi } from 'vitest';

vi.mock('../lib/jackson', () => ({
  jackson: {
    apiController: {},
    oauthController: {},
    redirectUrl: 'http://ares-sso.test/*',
    defaultRedirectUrl: {
      saml: 'http://ares-sso.test/sso/jxn/saml/callback',
      oidc: 'http://ares-sso.test/sso/jxn/oidc/callback'
    }
  }
}));

vi.mock('../email/client', () => {
  let sender = { id: 'relay_sender_test' };
  let emailIdentity = { id: 'relay_email_identity_test' };

  return {
    relay: {
      sender: { upsert: vi.fn(async () => sender) },
      emailIdentity: { upsert: vi.fn(async () => emailIdentity) },
      email: { send: vi.fn(async () => undefined) }
    },
    sender: Promise.resolve(sender),
    emailIdentity: Promise.resolve(emailIdentity),
    createTemplateSender: () => ({
      send: vi.fn(async () => undefined)
    })
  };
});
