import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import {
  db,
  getId,
  type ProviderVersionSpecificationDiscoveryStatus
} from '@metorial-subspace/db';
import { env } from '../../env';

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
  redisUrl: env.service.REDIS_URL
});

export let providerVersionSetSpecificationQueueProcessor =
  providerVersionSetSpecificationQueue.process(async data => {
    let version = await db.providerVersion.findFirst({
      where: { oid: data.versionOid }
    });
    if (!version) throw new QueueRetryError();

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
        specificationOid: null
      };
    }

    version = await db.providerVersion.update({
      where: { oid: version.oid },
      data: result
    });

    if (version.specificationOid && version.previousVersionOid) {
      let previousVersion = await db.providerVersion.findFirstOrThrow({
        where: { oid: version.previousVersionOid }
      });

      if (
        version.specificationOid !== previousVersion.specificationOid &&
        previousVersion.specificationOid
      ) {
        try {
          let change = await db.providerVersionSpecificationChange.create({
            data: {
              ...getId('providerVersionSpecificationChange'),

              toSpecificationOid: version.specificationOid,
              fromSpecificationOid: previousVersion.specificationOid,

              toVersionOid: version.oid,
              fromVersionOid: previousVersion.oid
            }
          });
          await db.providerSpecificationChangeNotification.create({
            data: {
              ...getId('providerSpecificationChangeNotification'),

              target: 'version',
              versionOid: version.oid,
              versionSpecificationChangeOid: change.oid
            }
          });
        } catch (e) {
          // Maybe a duplicate
        }
      }
    }
  });
