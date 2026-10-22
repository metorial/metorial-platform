import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  ID,
  type WebDiscovery,
  type WebDiscoveryStatus,
  withUniqueConstraintRecovery
} from '@metorial/db';
import { DISCOVERY_REUSE_WINDOW_MS } from '../lib/limits';
import { normalizeWebUrl } from '../lib/url';
import { runDiscoveryQueue } from '../queues/discovery';

class webDiscoveryServiceImpl {
  async discover(d: { url: string }) {
    let normalized = normalizeWebUrl(d.url);
    if (!normalized) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid URL',
          hint: 'Provide an absolute http or https URL.'
        })
      );
    }

    let newId = await ID.generateId('webDiscovery');
    let discovery = await withUniqueConstraintRecovery(
      () =>
        db.webDiscovery.upsert({
          where: { urlKey: normalized.urlKey },
          create: {
            id: newId,
            status: 'pending',
            urlKey: normalized.urlKey,
            url: normalized.pageUrl,
            host: normalized.host,
            registrableDomain: normalized.registrableDomain
          },
          update: {}
        }),
      () => db.webDiscovery.findUnique({ where: { urlKey: normalized.urlKey } })
    );

    let shouldRun = discovery.id === newId;

    if (!shouldRun) {
      let cutoff = new Date(Date.now() - DISCOVERY_REUSE_WINDOW_MS);

      if (discovery.status === 'failed' || discovery.startedAt < cutoff) {
        let reset = await db.webDiscovery.updateMany({
          where: {
            oid: discovery.oid,
            OR: [{ status: 'failed' }, { startedAt: { lt: cutoff } }]
          },
          data: {
            status: 'pending',
            attempts: 0,
            leaseExpiresAt: null,
            errorCode: null,
            errorMessage: null,
            startedAt: new Date(),
            completedAt: null
          }
        });

        shouldRun = reset.count > 0;

        if (shouldRun) {
          discovery = await db.webDiscovery.findUniqueOrThrow({
            where: { oid: discovery.oid }
          });
        }
      }
    }

    if (shouldRun) {
      await runDiscoveryQueue.add(
        { discoveryId: discovery.id },
        { id: `${discovery.id}_${discovery.startedAt.getTime()}` }
      );
    }

    return discovery;
  }

  async getWebDiscoveryById(d: { webDiscoveryId: string }) {
    let discovery = await db.webDiscovery.findUnique({ where: { id: d.webDiscoveryId } });
    if (!discovery) throw new ServiceError(notFoundError('web_discovery', d.webDiscoveryId));

    return discovery;
  }

  async getWebDiscoveryByUrl(d: { url: string }) {
    let normalized = normalizeWebUrl(d.url);
    if (!normalized) return null;

    return await db.webDiscovery.findUnique({ where: { urlKey: normalized.urlKey } });
  }

  isTerminal(discovery: Pick<WebDiscovery, 'status'> | { status: WebDiscoveryStatus }) {
    return discovery.status === 'succeeded' || discovery.status === 'failed';
  }
}

export let webDiscoveryService = Service.create(
  'webDiscovery',
  () => new webDiscoveryServiceImpl()
).build();
