import { describe, expect, it, vi } from 'vitest';
import { checkEmailDomain } from './check';
import { createDisposableEmailDomains, parseDisposableDomainList } from './disposable';
import { getDomainWithParents, matchesDomainSuffix } from './domain';
import { hasMxRecords, MxLookupError } from './mx';

let jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

let textResponse = (body: string, status = 200) => new Response(body, { status });

describe('matchesDomainSuffix', () => {
  it('matches exact domains and subdomains on label boundaries', () => {
    expect(matchesDomainSuffix('onboarding.metorial.net', ['onboarding.metorial.net'])).toBe(
      true
    );
    expect(
      matchesDomainSuffix('123.onboarding.metorial.net', ['onboarding.metorial.net'])
    ).toBe(true);
    expect(matchesDomainSuffix('evilmetorial.net', ['metorial.net'])).toBe(false);
  });

  it('is case and dot insensitive', () => {
    expect(matchesDomainSuffix('A.Example.COM.', ['example.com'])).toBe(true);
  });
});

describe('getDomainWithParents', () => {
  it('lists the domain and its parents without the bare tld', () => {
    expect(getDomainWithParents('a.b.example.com')).toEqual([
      'a.b.example.com',
      'b.example.com',
      'example.com'
    ]);
  });
});

describe('parseDisposableDomainList', () => {
  it('parses line based lists and skips comments and blanks', () => {
    expect(
      parseDisposableDomainList('# comment\nmailinator.com\n\n  TEMP.org \r\n', 'lines')
    ).toEqual(['mailinator.com', 'temp.org']);
  });

  it('parses json arrays', () => {
    expect(parseDisposableDomainList('["a.com", 3, "b.io"]', 'json-array')).toEqual([
      'a.com',
      'b.io'
    ]);
  });
});

describe('createDisposableEmailDomains', () => {
  let sources = [
    { name: 'lines', url: 'https://lists.test/lines', format: 'lines' as const },
    { name: 'json', url: 'https://lists.test/json', format: 'json-array' as const }
  ];

  it('merges all sources and matches parent domains', async () => {
    let fetcher = vi.fn(async (url: string) =>
      url.endsWith('json')
        ? jsonResponse(['guerrillamail.com'])
        : textResponse('mailinator.com')
    );

    let domains = createDisposableEmailDomains({ sources, fetch: fetcher as any });

    expect(await domains.isDisposable('mailinator.com')).toBe(true);
    expect(await domains.isDisposable('x.guerrillamail.com')).toBe(true);
    expect(await domains.isDisposable('example.com')).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('respects the allowlist', async () => {
    let fetcher = vi.fn(async () => textResponse('gmail.com'));
    let domains = createDisposableEmailDomains({
      sources: [sources[0]!],
      allowlist: ['gmail.com'],
      fetch: fetcher as any
    });

    expect(await domains.isDisposable('gmail.com')).toBe(false);
  });

  it('keeps the previous list when every source fails', async () => {
    let fail = false;
    let fetcher = vi.fn(async () => {
      if (fail) throw new Error('offline');
      return textResponse('mailinator.com');
    });

    let domains = createDisposableEmailDomains({
      sources: [sources[0]!],
      fetch: fetcher as any
    });
    expect(await domains.isDisposable('mailinator.com')).toBe(true);

    fail = true;
    await domains.refresh();

    expect(await domains.isDisposable('mailinator.com')).toBe(true);
  });
});

describe('hasMxRecords', () => {
  it('returns true for NOERROR responses with MX answers', async () => {
    let fetcher = vi.fn(async () =>
      jsonResponse({ Status: 0, Answer: [{ type: 15, data: '10 mx.example.com.' }] })
    );

    expect(await hasMxRecords('example.com', { fetch: fetcher as any })).toBe(true);
    expect(String(fetcher.mock.calls[0]![0])).toContain(
      'dns.google/resolve?name=example.com&type=MX'
    );
  });

  it('returns false for NOERROR without answers and for null MX', async () => {
    expect(
      await hasMxRecords('example.com', {
        fetch: (async () => jsonResponse({ Status: 0 })) as any
      })
    ).toBe(false);

    expect(
      await hasMxRecords('example.com', {
        fetch: (async () =>
          jsonResponse({ Status: 0, Answer: [{ type: 15, data: '0 .' }] })) as any
      })
    ).toBe(false);
  });

  it('returns false for NXDOMAIN', async () => {
    expect(
      await hasMxRecords('nope.invalid', {
        fetch: (async () => jsonResponse({ Status: 3 })) as any
      })
    ).toBe(false);
  });

  it('throws a retryable error on network failure or timeout', async () => {
    await expect(
      hasMxRecords('example.com', {
        fetch: (async () => {
          throw new Error('offline');
        }) as any
      })
    ).rejects.toBeInstanceOf(MxLookupError);

    await expect(
      hasMxRecords('example.com', {
        timeoutMs: 5,
        fetch: ((_: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal!.addEventListener('abort', () => reject(new Error('aborted')))
          )) as any
      })
    ).rejects.toBeInstanceOf(MxLookupError);
  });
});

describe('checkEmailDomain', () => {
  let notDisposable = { isDisposable: async () => false };
  let hasMx = async () => true;

  it('accepts a valid email', async () => {
    expect(
      await checkEmailDomain(' Jane.Doe+cli@Example.com ', {
        disposableEmailDomains: notDisposable,
        hasMxRecords: hasMx
      })
    ).toEqual({
      ok: true,
      email: 'jane.doe+cli@example.com',
      normalizedEmail: 'jane.doe@example.com',
      domain: 'example.com'
    });
  });

  it('rejects invalid syntax', async () => {
    expect(await checkEmailDomain('not-an-email')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects blocked domain suffixes', async () => {
    expect(
      await checkEmailDomain('cli@1.onboarding.metorial.net', {
        blockedDomainSuffixes: ['onboarding.metorial.net'],
        disposableEmailDomains: notDisposable,
        hasMxRecords: hasMx
      })
    ).toEqual({ ok: false, reason: 'blocked_domain' });
  });

  it('rejects disposable domains', async () => {
    expect(
      await checkEmailDomain('a@mailinator.com', {
        disposableEmailDomains: { isDisposable: async () => true },
        hasMxRecords: hasMx
      })
    ).toEqual({ ok: false, reason: 'disposable' });
  });

  it('rejects domains without mx records', async () => {
    expect(
      await checkEmailDomain('a@example.com', {
        disposableEmailDomains: notDisposable,
        hasMxRecords: async () => false
      })
    ).toEqual({ ok: false, reason: 'no_mx' });
  });
});
