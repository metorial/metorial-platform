import { badRequestError, isServiceError, ServiceError } from '@lowerdeck/error';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { oauthErrorPage } from './oauthErrorPage';

let appThrowing = (error: unknown) =>
  new Hono()
    .use(oauthErrorPage)
    .get('/', async () => {
      throw error;
    })
    .onError((e, c) =>
      isServiceError(e)
        ? c.json(e.toResponse(), e.data.status)
        : c.json({ unexpected: true }, 500)
    );

describe('oauthErrorPage', () => {
  it('renders a service error as an escaped HTML page with its status', async () => {
    let res = await appThrowing(
      new ServiceError(
        badRequestError({
          message: 'Started in a <b>different</b> browser.',
          code: 'setup_cookie_mismatch'
        })
      )
    ).request('/');

    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toBe('no-store');

    let body = await res.text();
    expect(body).toContain('Started in a &lt;b&gt;different&lt;/b&gt; browser.');
    expect(body).not.toContain('<b>different</b>');
    expect(body).not.toContain('setup_cookie_mismatch');
  });

  it('leaves unexpected errors to the app error handler', async () => {
    let res = await appThrowing(new Error('boom')).request('/');

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ unexpected: true });
  });

  it('passes successful responses through', async () => {
    let res = await new Hono()
      .use(oauthErrorPage)
      .get('/', c => c.redirect('https://example.com/next'))
      .request('/');

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/next');
  });
});
