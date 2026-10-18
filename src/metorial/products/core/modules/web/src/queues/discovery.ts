import { createQueue, QueueRetryError } from '@metorial/queue';
import { db, ID, Prisma, type WebPage } from '@metorial/db';
import { createFetchBudget, WebFetchError } from '../lib/fetch';
import { inspectPage, type InspectedPage } from '../lib/inspectPage';
import {
  DISCOVERY_DEADLINE_MS,
  DISCOVERY_LEASE_MS,
  DISCOVERY_MAX_ATTEMPTS,
  PAGE_REUSE_WINDOW_MS
} from '../lib/limits';
import { isGoodScore, pickBestCandidate, type RankedCandidate } from '../lib/rank';
import { buildPageChain, normalizeWebUrl } from '../lib/url';

type PageEntry = RankedCandidate & { pageOid: bigint };

let retryablePageErrors = ['timeout', 'network_error', 'http_server_error'];

export let runDiscoveryQueue = createQueue<{ discoveryId: string }>({
  name: 'web/discovery/run',
  workerOpts: { concurrency: 5, limiter: { max: 5, duration: 1000 } }
});

let pageData = (page: InspectedPage) => ({
  finalUrl: page.finalUrl,
  httpStatus: page.httpStatus,
  contentType: page.contentType,
  bytesRead: page.bytesRead,
  errorCode: page.errorCode,

  title: page.title,
  description: page.description,
  siteName: page.siteName,
  lang: page.lang,
  themeColor: page.themeColor,
  canonicalUrl: page.canonicalUrl,

  candidates: page.candidates,

  fetchedAt: new Date()
});

export let runDiscoveryProcessor = runDiscoveryQueue.process(async data => {
  let discovery = await db.webDiscovery.findUnique({ where: { id: data.discoveryId } });
  if (!discovery) return;

  let now = new Date();
  let claim = await db.webDiscovery.updateMany({
    where: {
      oid: discovery.oid,
      OR: [{ status: 'pending' }, { status: 'running', leaseExpiresAt: { lt: now } }]
    },
    data: {
      status: 'running',
      leaseExpiresAt: new Date(now.getTime() + DISCOVERY_LEASE_MS),
      attempts: { increment: 1 }
    }
  });
  if (claim.count == 0) return;

  let attempt = discovery.attempts + 1;

  try {
    let normalized = normalizeWebUrl(discovery.url);
    if (!normalized) {
      await db.webDiscovery.updateMany({
        where: { oid: discovery.oid },
        data: {
          status: 'failed',
          leaseExpiresAt: null,
          completedAt: new Date(),
          errorCode: 'invalid_url',
          errorMessage: 'The URL could not be normalized'
        }
      });
      return;
    }

    let chain = buildPageChain(normalized);
    let budget = createFetchBudget(DISCOVERY_DEADLINE_MS);

    let entries: PageEntry[] = [];
    let pages: WebPage[] = [];
    let pageErrors: string[] = [];

    for (let [index, url] of chain.entries()) {
      if (budget.signal.aborted) {
        pageErrors.push('timeout');
        break;
      }

      let cached = await db.webPage.findUnique({ where: { url } });
      let isFresh =
        cached &&
        !cached.errorCode &&
        Date.now() - cached.fetchedAt.getTime() < PAGE_REUSE_WINDOW_MS;

      let page = cached;
      if (!cached || !isFresh) {
        let inspected = await inspectPage({
          url,
          budget,
          isSiteRoot: new URL(url).pathname == '/'
        });

        page = await db.webPage.upsert({
          where: { url },
          create: { id: await ID.generateId('webPage'), url, ...pageData(inspected) },
          update: pageData(inspected)
        });
      }

      if (page!.errorCode) {
        pageErrors.push(page!.errorCode);
        continue;
      }

      pages.push(page!);
      for (let candidate of page!.candidates) {
        entries.push({ pageIndex: index, pageOid: page!.oid, candidate });
      }

      let best = pickBestCandidate(entries);
      if (best && isGoodScore(best.candidate.score!)) break;
    }

    if (!pages.length) {
      let isRetryable = pageErrors.some(code => retryablePageErrors.includes(code));

      if (isRetryable && attempt < DISCOVERY_MAX_ATTEMPTS) {
        await db.webDiscovery.updateMany({
          where: { oid: discovery.oid },
          data: { status: 'pending', leaseExpiresAt: null }
        });

        throw new QueueRetryError();
      }

      await db.webDiscovery.updateMany({
        where: { oid: discovery.oid },
        data: {
          status: 'failed',
          leaseExpiresAt: null,
          completedAt: new Date(),
          errorCode: 'no_page_reachable',
          errorMessage: [...new Set(pageErrors)].join(', ').slice(0, 500)
        }
      });
      return;
    }

    let best = pickBestCandidate(entries);
    let firstOf = <
      K extends 'title' | 'description' | 'siteName' | 'lang' | 'themeColor' | 'canonicalUrl'
    >(
      key: K
    ) => pages.find(page => page[key])?.[key] ?? null;

    await db.webDiscovery.updateMany({
      where: { oid: discovery.oid },
      data: {
        status: 'succeeded',
        leaseExpiresAt: null,
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,

        title: firstOf('title'),
        description: firstOf('description'),
        siteName: firstOf('siteName'),
        lang: firstOf('lang'),
        themeColor: firstOf('themeColor'),
        canonicalUrl: firstOf('canonicalUrl'),

        image: best ? { type: 'url', url: best.candidate.url } : Prisma.DbNull,
        imageWidth: best?.candidate.width ?? null,
        imageHeight: best?.candidate.height ?? null,
        imageSource: best?.candidate.source ?? null,
        imageScore: best?.candidate.score ?? null,

        bestPageOid: best?.pageOid ?? null
      }
    });
  } catch (error) {
    if (error instanceof QueueRetryError) throw error;

    await db.webDiscovery.updateMany({
      where: { oid: discovery.oid, status: 'running' },
      data: { status: 'pending', leaseExpiresAt: null }
    });

    throw error;
  }
});
