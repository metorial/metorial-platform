import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ safeFetch: vi.fn() }));

vi.mock('@lowerdeck/ssrf', () => ({ safeFetch: mocks.safeFetch }));

import { createFetchBudget, guardedFetch, readCapped } from '../src/lib/fetch';
import { MAX_REQUESTS_PER_DISCOVERY } from '../src/lib/limits';

let streamOf = (chunks: Uint8Array[], onCancel?: () => void) =>
  new ReadableStream<Uint8Array>({
    pull(controller) {
      let chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel: onCancel
  });

let bytes = (length: number) => new Uint8Array(length).fill(97);

describe('readCapped', () => {
  it('reads a body under the cap', async () => {
    let response = new Response(streamOf([bytes(10), bytes(5)]));

    let result = await readCapped(response, { maxBytes: 100 });

    expect(result.bytes.length).toBe(15);
    expect(result.isTruncated).toBe(false);
  });

  it('throws when a body exceeds the cap and cancels the stream', async () => {
    let cancelled = vi.fn();
    let response = new Response(streamOf([bytes(60), bytes(60), bytes(60)], cancelled));

    await expect(readCapped(response, { maxBytes: 100 })).rejects.toMatchObject({
      code: 'too_large'
    });
    expect(cancelled).toHaveBeenCalled();
  });

  it('rejects early on content-length', async () => {
    let response = new Response(streamOf([bytes(10)]), {
      headers: { 'content-length': '5000' }
    });

    await expect(readCapped(response, { maxBytes: 100 })).rejects.toMatchObject({
      code: 'too_large'
    });
  });

  it('truncates instead of throwing when asked to', async () => {
    let response = new Response(streamOf([bytes(60), bytes(60)]));

    let result = await readCapped(response, { maxBytes: 100, truncate: true });

    expect(result.bytes.length).toBe(100);
    expect(result.isTruncated).toBe(true);
  });

  it('stops reading after the marker even across chunk boundaries', async () => {
    let encoder = new TextEncoder();
    let cancelled = vi.fn();
    let response = new Response(
      streamOf(
        [encoder.encode('<head></he'), encoder.encode('AD><body>'), bytes(1000)],
        cancelled
      )
    );

    let result = await readCapped(response, {
      maxBytes: 10_000,
      truncate: true,
      stopAfter: '</head>'
    });

    expect(new TextDecoder().decode(result.bytes)).toBe('<head></heAD><body>');
    expect(result.isTruncated).toBe(true);
    expect(cancelled).toHaveBeenCalled();
  });
});

describe('guardedFetch', () => {
  beforeEach(() => {
    mocks.safeFetch.mockReset();
  });

  let budget = () => createFetchBudget(60_000);
  let options = { accept: 'text/html', maxBytes: 1000 };

  it('returns the body and final url', async () => {
    mocks.safeFetch.mockResolvedValue(
      Object.defineProperty(
        new Response('hello', { headers: { 'content-type': 'text/html' } }),
        'url',
        { value: 'https://example.com/final' }
      )
    );

    let result = await guardedFetch('https://example.com/', { ...options, budget: budget() });

    expect(new TextDecoder().decode(result.bytes)).toBe('hello');
    expect(result.finalUrl).toBe('https://example.com/final');
    expect(result.contentType).toBe('text/html');
  });

  it('restricts ports through the assertUrl hook', async () => {
    mocks.safeFetch.mockResolvedValue(new Response('ok'));

    await guardedFetch('https://example.com/', { ...options, budget: budget() });

    let assertUrl = mocks.safeFetch.mock.calls[0]![1].assertUrl;

    expect(() => assertUrl(new URL('https://example.com/'))).not.toThrow();
    expect(() => assertUrl(new URL('https://example.com:443/'))).not.toThrow();
    expect(() => assertUrl(new URL('http://example.com:6379/'))).toThrow();
  });

  it('classifies blocked addresses as permanent errors', async () => {
    mocks.safeFetch.mockRejectedValue(new Error('Private or internal IP blocked'));

    let error = await guardedFetch('https://internal.example.com/', {
      ...options,
      budget: budget()
    }).catch(e => e);

    expect(error).toMatchObject({ code: 'blocked_address', isRetryable: false });
  });

  it('classifies timeouts and server errors as retryable', async () => {
    mocks.safeFetch.mockRejectedValueOnce(
      Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    );
    mocks.safeFetch.mockResolvedValueOnce(new Response('x', { status: 503 }));

    let timeout = await guardedFetch('https://a.com/', { ...options, budget: budget() }).catch(
      e => e
    );
    let server = await guardedFetch('https://a.com/', { ...options, budget: budget() }).catch(
      e => e
    );

    expect(timeout).toMatchObject({ code: 'timeout', isRetryable: true });
    expect(server).toMatchObject({ code: 'http_server_error', isRetryable: true });
  });

  it('treats client errors as permanent', async () => {
    mocks.safeFetch.mockResolvedValue(new Response('nope', { status: 404 }));

    let error = await guardedFetch('https://a.com/', { ...options, budget: budget() }).catch(
      e => e
    );

    expect(error).toMatchObject({ code: 'http_client_error', isRetryable: false });
  });

  it('enforces the per discovery request budget', async () => {
    mocks.safeFetch.mockImplementation(async () => new Response('ok'));
    let shared = budget();

    for (let i = 0; i < MAX_REQUESTS_PER_DISCOVERY; i++) {
      await guardedFetch('https://a.com/', { ...options, budget: shared });
    }

    await expect(
      guardedFetch('https://a.com/', { ...options, budget: shared })
    ).rejects.toMatchObject({ code: 'budget_exhausted' });
  });
});
