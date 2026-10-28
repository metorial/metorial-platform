import { badRequestError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  startOAuthFlow: vi.fn(),
  completeOAuthFlow: vi.fn(),
  reportError: vi.fn()
}));

vi.mock('../../env', () => ({ env: { service: { METORIAL_ENV: 'development' } } }));

vi.mock('../../services/slateOAuthHandler', () => ({
  slateOAuthHandlerService: {
    startOAuthFlow: mocks.startOAuthFlow,
    completeOAuthFlow: mocks.completeOAuthFlow,
    reportError: mocks.reportError
  }
}));

vi.mock('../../services/slateWebhookRegistration', () => ({
  slateWebhookRegistrationService: {}
}));
vi.mock('../../lib/ingestWebhookRequest', () => ({
  ingestWebhookRequest: vi.fn(),
  MAX_WEBHOOK_BODY_BYTES: 1024,
  payloadTooLargeError: {}
}));
vi.mock('./integrationAttachment', async () => ({
  integrationAttachmentApp: new (await import('hono')).Hono()
}));
vi.mock('./liveInvocation', async () => {
  let { Hono } = await import('hono');
  let { badRequestError, ServiceError } = await import('@lowerdeck/error');

  return {
    liveInvocationApp: new Hono().post('/slates-hub/live-invocation/attachments', () => {
      throw new ServiceError(badRequestError({ message: 'Invalid attachment' }));
    })
  };
});

let { hubApp } = await import('./index');

let cookieMismatch = () =>
  new ServiceError(
    badRequestError({
      message: 'This admin setup was started in a different browser.',
      code: 'setup_cookie_mismatch'
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('hub OAuth browser routes', () => {
  it('renders a rejected callback as an HTML page instead of JSON', async () => {
    mocks.completeOAuthFlow.mockRejectedValue(cookieMismatch());

    let res = await hubApp.request('/slates-hub/callback?state=shios_1', {
      headers: { Cookie: 'slates_hub_oauth_setup_shios_other=shios_other' }
    });

    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('This admin setup was started in a different browser.');
  });

  it('renders a callback without any setup cookie as an HTML page', async () => {
    let res = await hubApp.request('/slates-hub/callback?state=shios_1');

    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('OAuth setup cookie is missing');
    expect(mocks.completeOAuthFlow).not.toHaveBeenCalled();
  });

  it('renders a refused authorization start as an HTML page', async () => {
    mocks.startOAuthFlow.mockRejectedValue(
      new ServiceError(badRequestError({ message: 'This admin setup has failed.' }))
    );

    let res = await hubApp.request('/slates-hub/authorization?setup_id=shios_1');

    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('This admin setup has failed.');
  });

  it('still redirects a successful callback', async () => {
    mocks.completeOAuthFlow.mockResolvedValue({
      redirectUrl: 'https://integrations.test/done'
    });

    let res = await hubApp.request('/slates-hub/callback?state=shios_1&code=abc', {
      headers: { Cookie: 'slates_hub_oauth_setup_shios_1=shios_1' }
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://integrations.test/done');
  });

  it('keeps JSON errors on other /slates-hub routes', async () => {
    let res = await hubApp.request('/slates-hub/live-invocation/attachments', {
      method: 'POST'
    });

    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toMatchObject({ message: 'Invalid attachment' });
  });

  it('keeps the setup cookie deletion on a rendered error page', async () => {
    mocks.completeOAuthFlow.mockRejectedValue(cookieMismatch());

    let res = await hubApp.request('/slates-hub/callback?state=shios_1', {
      headers: { Cookie: 'slates_hub_oauth_setup_shios_1=shios_1' }
    });

    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('set-cookie')).toContain('slates_hub_oauth_setup_shios_1=;');
  });
});
