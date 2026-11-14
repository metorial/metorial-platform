import { eventually, expectServiceError, uniqueId } from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizeWebUrl, webDiscoveryService } from '../src';
import { createFetchBudget, guardedFetch, WebFetchError } from '../src/lib/fetch';
import { recoverDiscoveriesManyQueue } from '../src/queues/recovery';

let SETTLE_TIMEOUT_MS = 60_000;
let TEST_TIMEOUT_MS = 120_000;
let DAY_MS = 24 * 60 * 60 * 1000;

let settled = (webDiscoveryId: string, timeoutMs = SETTLE_TIMEOUT_MS) =>
  eventually(
    async () => {
      let current = await webDiscoveryService.getWebDiscoveryById({ webDiscoveryId });
      expect(webDiscoveryService.isTerminal(current)).toBe(true);
      return current;
    },
    { timeoutMs, intervalMs: 500 }
  );

let loopbackUrl = (path = uniqueId('e2e-page')) => `https://127.0.0.1/${path}`;

let goodCandidate = (url: string): PrismaJson.WebImageCandidate => ({
  url,
  source: 'apple_touch_icon',
  format: 'png',
  width: 256,
  height: 256,
  declaredWidth: 256,
  declaredHeight: 256,
  bytes: 4096,
  score: 96,
  rejectedReason: null
});

let seedPage = async (url: string, data: Record<string, unknown>) =>
  db.webPage.create({
    data: {
      id: await ID.generateId('webPage'),
      url,
      candidates: [],
      fetchedAt: new Date(),
      ...data
    }
  });

describe('module-web discovery', () => {
  let server: Server;
  let port: number;
  let received: string[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      received.push(`${request.method} ${request.url}`);
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><head><title>internal</title></head></html>');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('rejects urls that are not absolute http or https urls', async () => {
    let invalid = [
      'not a url',
      '',
      '/relative/path',
      '//example.com/x',
      'ftp://example.com/file',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'gopher://127.0.0.1:6379/_INFO',
      `https://example.com/${'a'.repeat(2100)}`
    ];

    for (let url of invalid) {
      await expectServiceError(webDiscoveryService.discover({ url }), 'bad_request');
      expect(await webDiscoveryService.getWebDiscoveryByUrl({ url })).toBeNull();
    }

    await expectServiceError(
      webDiscoveryService.getWebDiscoveryById({ webDiscoveryId: uniqueId('wdsc') }),
      'not_found'
    );
  });

  it('collapses scheme, credentials, port, query and host spelling into one discovery', async () => {
    let path = uniqueId('e2e-page');

    let discovery = await webDiscoveryService.discover({ url: `https://127.0.0.1/${path}` });
    expect(discovery).toMatchObject({
      status: 'pending',
      urlKey: `127.0.0.1/${path}`,
      url: `https://127.0.0.1/${path}`,
      host: '127.0.0.1'
    });

    for (let variant of [
      `http://127.0.0.1/${path}`,
      `https://127.0.0.1:${port}/${path}/`,
      `https://admin:secret@127.0.0.1/${path}?token=abc#frag`,
      `HTTPS://127.0.0.1/${path}//`,
      `https://2130706433/${path}`,
      `https://0x7f.0.0.1/${path}`,
      `  https://127.0.0.1./${path}  `
    ]) {
      let again = await webDiscoveryService.discover({ url: variant });
      expect(again.id, variant).toBe(discovery.id);
    }

    let stored = await db.webDiscovery.findUniqueOrThrow({ where: { id: discovery.id } });
    expect(stored.url).toBe(`https://127.0.0.1/${path}`);
    expect(
      JSON.stringify(stored, (_, value) => (typeof value == 'bigint' ? '' : value))
    ).not.toMatch(/secret|admin|token=abc/);

    let differentCase = await webDiscoveryService.discover({
      url: `https://127.0.0.1/${path.toUpperCase()}`
    });
    expect(differentCase.id).not.toBe(discovery.id);

    let concurrentPath = uniqueId('e2e-page');
    let concurrent = await Promise.all(
      Array.from({ length: 6 }, () =>
        webDiscoveryService.discover({ url: `https://127.0.0.1/${concurrentPath}` })
      )
    );
    expect(new Set(concurrent.map(item => item.id)).size).toBe(1);
    expect(
      await db.webDiscovery.count({ where: { urlKey: `127.0.0.1/${concurrentPath}` } })
    ).toBe(1);
  });

  it(
    'never connects to a local server and fails loopback, private and metadata hosts as blocked',
    async () => {
      let path = uniqueId('e2e-page');

      let local = await webDiscoveryService.discover({
        url: `http://127.0.0.1:${port}/${path}`
      });
      expect(local.url).toBe(`https://127.0.0.1/${path}`);

      let hosts = [
        'localhost',
        '10.0.0.1',
        '172.16.0.1',
        '192.168.1.1',
        '169.254.169.254',
        '100.64.0.1',
        '0.0.0.0'
      ];
      let blocked = await Promise.all(
        hosts.map(host => webDiscoveryService.discover({ url: `https://${host}/${path}` }))
      );

      for (let discovery of [local, ...blocked]) {
        let result = await settled(discovery.id);
        expect(result, discovery.url).toMatchObject({
          status: 'failed',
          errorCode: 'no_page_reachable',
          errorMessage: 'blocked_address',
          image: null
        });

        let page = await db.webPage.findUniqueOrThrow({ where: { url: discovery.url } });
        expect(page, discovery.url).toMatchObject({
          errorCode: 'blocked_address',
          httpStatus: null,
          finalUrl: null,
          candidates: []
        });
      }

      expect(received).toEqual([]);
    },
    TEST_TIMEOUT_MS
  );

  it('blocks the local server at the fetch layer before any request is made', async () => {
    let attempts = [
      `http://127.0.0.1:${port}/direct`,
      `http://localhost:${port}/direct`,
      `http://127.0.0.1/direct`,
      `http://[::ffff:127.0.0.1]:${port}/direct`,
      `http://admin:secret@127.0.0.1:${port}/direct`,
      `file:///etc/passwd`
    ];

    for (let url of attempts) {
      let error = await guardedFetch(url, {
        budget: createFetchBudget(10_000),
        accept: 'text/html',
        maxBytes: 1024
      }).then(
        () => null,
        error => error
      );

      expect(error, url).toBeInstanceOf(WebFetchError);
      expect(['blocked_address', 'invalid_url', 'network_error'], url).toContain(error.code);
    }

    let loopbackCode = await guardedFetch(`http://127.0.0.1:${port}/direct`, {
      budget: createFetchBudget(10_000),
      accept: 'text/html',
      maxBytes: 1024
    }).catch(error => error.code);
    expect(loopbackCode).toBe('blocked_address');

    let credentialsCode = await guardedFetch(`http://admin:secret@example.com/direct`, {
      budget: createFetchBudget(10_000),
      accept: 'text/html',
      maxBytes: 1024
    }).catch(error => error.code);
    expect(credentialsCode).toBe('invalid_url');

    let exhausted = createFetchBudget(10_000);
    exhausted.requests = 15;
    let exhaustedCode = await guardedFetch(`http://127.0.0.1:${port}/direct`, {
      budget: exhausted,
      accept: 'text/html',
      maxBytes: 1024
    }).catch(error => error.code);
    expect(exhaustedCode).toBe('budget_exhausted');

    expect(received).toEqual([]);
  });

  it(
    'serves a discovery from fresh cached pages without refetching them',
    async () => {
      let url = loopbackUrl();
      let iconUrl = `${url}/apple-touch-icon.png`;
      let fetchedAt = new Date(Date.now() - 60 * 60 * 1000);

      let page = await seedPage(url, {
        finalUrl: url,
        httpStatus: 200,
        contentType: 'text/html',
        bytesRead: 512,
        title: 'Cached title',
        description: 'Cached description',
        siteName: 'Cached site',
        lang: 'en',
        themeColor: '#123456',
        canonicalUrl: url,
        candidates: [goodCandidate(iconUrl)],
        fetchedAt
      });

      let discovery = await webDiscoveryService.discover({ url });
      let result = await settled(discovery.id);

      expect(result).toMatchObject({
        status: 'succeeded',
        errorCode: null,
        title: 'Cached title',
        description: 'Cached description',
        siteName: 'Cached site',
        lang: 'en',
        themeColor: '#123456',
        canonicalUrl: url,
        image: { type: 'url', url: iconUrl },
        imageWidth: 256,
        imageHeight: 256,
        imageSource: 'apple_touch_icon',
        imageScore: 96,
        bestPageOid: page.oid
      });
      expect(result.completedAt).not.toBeNull();

      let after = await db.webPage.findUniqueOrThrow({ where: { oid: page.oid } });
      expect(after.fetchedAt.getTime()).toBe(fetchedAt.getTime());

      let reused = await webDiscoveryService.discover({ url });
      expect(reused).toMatchObject({ id: discovery.id, status: 'succeeded' });
      expect(reused.startedAt.getTime()).toBe(result.startedAt.getTime());
    },
    TEST_TIMEOUT_MS
  );

  it(
    'refetches cached pages that are stale or recorded an error',
    async () => {
      let staleUrl = loopbackUrl();
      let erroredUrl = loopbackUrl();
      let staleFetchedAt = new Date(Date.now() - 2 * DAY_MS);
      let erroredFetchedAt = new Date(Date.now() - 60 * 1000);

      await seedPage(staleUrl, {
        httpStatus: 200,
        title: 'Stale title',
        candidates: [goodCandidate(`${staleUrl}/icon.png`)],
        fetchedAt: staleFetchedAt
      });
      await seedPage(erroredUrl, { errorCode: 'timeout', fetchedAt: erroredFetchedAt });

      for (let [url, previousFetchedAt] of [
        [staleUrl, staleFetchedAt],
        [erroredUrl, erroredFetchedAt]
      ] as const) {
        let discovery = await webDiscoveryService.discover({ url });
        let result = await settled(discovery.id);
        expect(result, url).toMatchObject({
          status: 'failed',
          errorCode: 'no_page_reachable'
        });

        let page = await db.webPage.findUniqueOrThrow({ where: { url } });
        expect(page, url).toMatchObject({
          errorCode: 'blocked_address',
          title: null,
          candidates: []
        });
        expect(page.fetchedAt.getTime()).toBeGreaterThan(previousFetchedAt.getTime());
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    're-runs failed and stale discoveries but reuses recent successful ones',
    async () => {
      let url = loopbackUrl();

      let first = await webDiscoveryService.discover({ url });
      let failed = await settled(first.id);
      expect(failed).toMatchObject({ status: 'failed', attempts: 1 });

      let retried = await webDiscoveryService.discover({ url });
      expect(retried).toMatchObject({
        id: first.id,
        status: 'pending',
        attempts: 0,
        errorCode: null,
        errorMessage: null,
        completedAt: null
      });
      expect(retried.startedAt.getTime()).toBeGreaterThan(failed.startedAt.getTime());

      let failedAgain = await settled(first.id);
      expect(failedAgain).toMatchObject({ status: 'failed', attempts: 1 });

      await db.webDiscovery.update({
        where: { id: first.id },
        data: { status: 'succeeded', errorCode: null, errorMessage: null, title: 'Kept' }
      });

      let reused = await webDiscoveryService.discover({ url });
      expect(reused).toMatchObject({ status: 'succeeded', title: 'Kept' });
      expect(reused.startedAt.getTime()).toBe(failedAgain.startedAt.getTime());

      await db.webDiscovery.update({
        where: { id: first.id },
        data: { startedAt: new Date(Date.now() - DAY_MS - 60_000) }
      });

      let refreshed = await webDiscoveryService.discover({ url });
      expect(refreshed).toMatchObject({ status: 'pending', attempts: 0 });

      let rerun = await settled(first.id);
      expect(rerun).toMatchObject({ status: 'failed', errorCode: 'no_page_reachable' });
    },
    TEST_TIMEOUT_MS
  );

  it(
    'recovers discoveries whose worker lease expired or that sat pending too long',
    async () => {
      let leased = await webDiscoveryService.discover({ url: loopbackUrl() });
      let pending = await webDiscoveryService.discover({ url: loopbackUrl() });
      await settled(leased.id);
      await settled(pending.id);

      await db.webDiscovery.update({
        where: { id: leased.id },
        data: {
          status: 'running',
          attempts: 1,
          leaseExpiresAt: new Date(Date.now() - 1_000),
          completedAt: null
        }
      });
      await db.webDiscovery.update({
        where: { id: pending.id },
        data: {
          status: 'pending',
          attempts: 0,
          startedAt: new Date(Date.now() - 20 * 60 * 1000),
          completedAt: null
        }
      });

      let active = await webDiscoveryService.discover({ url: loopbackUrl() });
      await settled(active.id);
      await db.webDiscovery.update({
        where: { id: active.id },
        data: {
          status: 'running',
          attempts: 1,
          leaseExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
          completedAt: null
        }
      });

      await recoverDiscoveriesManyQueue.add({});

      let recoveredLease = await settled(leased.id);
      expect(recoveredLease).toMatchObject({ status: 'failed', attempts: 2 });

      let recoveredPending = await settled(pending.id);
      expect(recoveredPending).toMatchObject({ status: 'failed', attempts: 1 });

      expect(
        await db.webDiscovery.findUniqueOrThrow({ where: { id: active.id } })
      ).toMatchObject({ status: 'running', attempts: 1 });
    },
    TEST_TIMEOUT_MS
  );

  it('keeps normalization consistent with the stored url key', () => {
    expect(normalizeWebUrl(`https://user:pw@127.0.0.1:${port}/A/b/?q=1#x`)).toEqual({
      urlKey: '127.0.0.1/A/b',
      pageUrl: 'https://127.0.0.1/A/b',
      host: '127.0.0.1',
      pathname: '/A/b',
      registrableDomain: null
    });
  });
});
