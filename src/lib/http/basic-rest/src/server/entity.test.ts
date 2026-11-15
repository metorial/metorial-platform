import { describe, expect, it, vi } from 'vitest';
import { v } from '@lowerdeck/validation';
import { EntityProvider } from './entityProvider';

let makeRequest = (init: {
  url?: string;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}) =>
  new Request(init.url ?? 'https://example.com/test', {
    method: init.method ?? 'GET',
    headers: init.headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });

describe('EntityProvider', () => {
  it('routes and returns a JSON response', async () => {
    let provider = new EntityProvider(async () => ({}));
    let entity = provider
      .entity({
        id: 'test',
        name: 'Test Entity',
        provider: async () => ({})
      })()
      .action('list', {
        type: 'list',
        name: 'List',
        input: v.object({}),
        needsProvider: false,
        handler: async () => ({ ok: true })
      });

    let endpoint = provider.service([entity], { path: '/api' });
    let res = await endpoint.fetch(
      makeRequest({ url: 'https://example.com/api/test', method: 'GET' })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns a service error response for missing routes', async () => {
    let provider = new EntityProvider(async () => ({}));
    let endpoint = provider.service([], { path: '/api' });
    let res = await endpoint.fetch(
      makeRequest({ url: 'https://example.com/api/test', method: 'GET' })
    );
    let body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe('not_found');
  });

  it('strips entity ids from the input body before validation', async () => {
    let handler = vi.fn(async () => ({ ok: true }));
    let provider = new EntityProvider(async () => ({}));
    let entity = provider
      .entity({
        id: 'test',
        name: 'Test Entity',
        provider: async () => ({})
      })()
      .action('create', {
        type: 'create',
        name: 'Create',
        input: v.object({
          name: v.string()
        }),
        needsProvider: true,
        handler
      });

    let endpoint = provider.service([entity], { path: '/api' });
    let res = await endpoint.fetch(
      makeRequest({
        url: 'https://example.com/api/test/abc',
        method: 'POST',
        body: {
          testId: 'abc',
          input: {
            name: 'Alpha'
          }
        }
      })
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(handler).toHaveBeenCalled();
  });

  it('routes nested entities through sub-entity paths', async () => {
    let provider = new EntityProvider(async () => ({}));
    let onboarding = provider
      .entity({
        id: 'onboarding',
        name: 'Onboarding',
        provider: async () => ({})
      })()
    let task = onboarding
      .subEntity({
        id: 'task',
        name: 'Task',
        provider: async () => ({})
      })()
      .action('complete', {
        type: 'special',
        name: 'Complete',
        input: v.object({
          onboardingId: v.string(),
          taskId: v.string()
        }),
        needsProvider: false,
        handler: async () => ({ ok: true })
      });

    let endpoint = provider.service([onboarding, task], { path: '/api' });
    let res = await endpoint.fetch(
      makeRequest({
        url: 'https://example.com/api/onboarding/task/complete',
        method: 'POST',
        body: {
          onboardingId: 'onb_1',
          taskId: 'task_1'
        }
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
