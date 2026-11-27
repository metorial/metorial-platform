import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import {
  db,
  getId,
  type ProviderVersionSpecificationDiscoveryStatus
} from '@metorial-subspace/db';
import { requestSecurityReview } from '@metorial-subspace/module-security-review-request';
import { schemaChangeNotificationAlertIngestQueue } from '@metorial-subspace/module-monitor/src/queues/schemaChange';
import { env } from '../../env';
import { markDiscoveryFinished } from '../../lib/discoverySignal';

export let providerVersionSetSpecificationQueue = createQueue<{
  versionOid: bigint;
  result:
    | {
        status: 'success';
        specificationOid: bigint;
        source: 'version' | 'pair';
      }
    | {
        status: 'not_discoverable';
      }
    | {
        status: 'waiting_for_pair';
      };
}>({
  name: 'sub/pint/pver/spec/set',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL
});

export let providerVersionSetSpecificationQueueProcessor =
  providerVersionSetSpecificationQueue.process(async data => {
    let version = await db.providerVersion.findFirst({
      where: { oid: data.versionOid }
    });
    if (!version) throw new QueueRetryError();
    let previousSpecificationOid = version.specificationOid;

    let result: {
      specificationDiscoveryStatus: ProviderVersionSpecificationDiscoveryStatus;
      specificationOid: bigint | null;
    };

    if (data.result.status === 'success') {
      result = {
        specificationDiscoveryStatus: 'discovered',
        specificationOid: data.result.specificationOid
      };
    } else {
      result = {
        specificationDiscoveryStatus: data.result.status,
        specificationOid: version.specificationOid
      };
    }

    version = await db.providerVersion.update({
      where: { oid: version.oid },
      data: result
    });

    await markDiscoveryFinished({
      kind: 'providerVersion',
      oid: version.oid,
      status: version.specificationDiscoveryStatus
    });

    if (previousSpecificationOid !== version.specificationOid) {
      await Promise.all([
        db.providerAuthConfig.updateMany({
          where: {
            providerOid: version.providerOid,
            status: { not: 'deleted' }
          },
          data: { needsScopeSync: true }
        }),
        db.providerAuthCredentials.updateMany({
          where: {
            providerOid: version.providerOid,
            status: { not: 'deleted' }
          },
          data: { needsScopeSync: true }
        })
      ]);
    }

    let recordSpecChange = async (d: {
      fromVersionOid: bigint;
      fromSpecificationOid: bigint;
      toSpecificationOid: bigint;
    }) => {
      try {
        let change = await db.providerVersionSpecificationChange.create({
          data: {
            ...getId('providerVersionSpecificationChange'),

            toSpecificationOid: d.toSpecificationOid,
            fromSpecificationOid: d.fromSpecificationOid,

            toVersionOid: version.oid,
            fromVersionOid: d.fromVersionOid
          }
        });
        let notification = await db.providerSpecificationChangeNotification.create({
          data: {
            ...getId('providerSpecificationChangeNotification'),

            target: 'version',
            versionOid: version.oid,
            versionSpecificationChangeOid: change.oid
          }
        });

        await schemaChangeNotificationAlertIngestQueue.add({
          notificationId: notification.id
        });
        await requestSecurityReview({ subject: 'specChange', id: change.id });
      } catch (e) {
        // Maybe a duplicate
      }
    };

    // A spec that changes without a version bump is recorded as a change from the version
    // to itself, so downstream consumers (security reviews, alerts) still see it.
    if (
      version.specificationOid &&
      previousSpecificationOid &&
      previousSpecificationOid !== version.specificationOid
    ) {
      await recordSpecChange({
        fromVersionOid: version.oid,
        fromSpecificationOid: previousSpecificationOid,
        toSpecificationOid: version.specificationOid
      });
    }

    if (version.specificationOid && version.previousVersionOid) {
      let previousVersion = await db.providerVersion.findFirstOrThrow({
        where: { oid: version.previousVersionOid }
      });

      if (
        version.specificationOid !== previousVersion.specificationOid &&
        previousVersion.specificationOid
      ) {
        await recordSpecChange({
          fromVersionOid: previousVersion.oid,
          fromSpecificationOid: previousVersion.specificationOid,
          toSpecificationOid: version.specificationOid
        });
      }
    }
  });
