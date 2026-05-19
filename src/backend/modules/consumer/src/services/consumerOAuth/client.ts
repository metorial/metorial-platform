import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, ID, type ConsumerSurface } from '@metorial/db';
import { getConsumerClientHash, normalizeConsumerClientRedirectUris } from './_helpers';
import { ConsumerOAuthClient } from './_types';

class ConsumerOAuthClientService {
  async upsertConsumerClient(d: {
    consumerSurface: Pick<ConsumerSurface, 'oid' | 'instanceOid' | 'organizationOid'>;
    name: string;
    redirectUris: string[];
  }) {
    let redirectUris = normalizeConsumerClientRedirectUris(d.redirectUris);
    let hash = await getConsumerClientHash({
      name: d.name,
      redirectUris
    });

    let consumerClient = await db.consumerClient.findFirst({
      where: {
        hash,
        consumerAuthClientConsumerSurfaces: {
          some: {
            consumerSurfaceOid: d.consumerSurface.oid
          }
        }
      }
    });

    if (!consumerClient) {
      return await db.consumerClient.create({
        data: {
          id: await ID.generateId('consumerClient'),
          instanceOid: d.consumerSurface.instanceOid,
          organizationOid: d.consumerSurface.organizationOid,
          hash,
          name: d.name,
          redirectUris
        }
      });
    }

    return await db.consumerClient.update({
      where: {
        oid: consumerClient.oid
      },
      data: {
        name: d.name,
        redirectUris,
        instanceOid: d.consumerSurface.instanceOid,
        organizationOid: d.consumerSurface.organizationOid
      }
    });
  }

  async ensureConsumerAuthClientConsumerSurface(d: {
    consumerAuthClient: Pick<ConsumerOAuthClient, 'oid'>;
    consumerSurface: Pick<ConsumerSurface, 'oid'>;
    consumerClient: { oid: bigint };
  }) {
    return await db.consumerAuthClientConsumerSurface.upsert({
      where: {
        consumerSurfaceOid_consumerAuthClientOid: {
          consumerSurfaceOid: d.consumerSurface.oid,
          consumerAuthClientOid: d.consumerAuthClient.oid
        }
      },
      create: {
        id: await ID.generateId('consumerAuthClient'),
        consumerSurfaceOid: d.consumerSurface.oid,
        consumerAuthClientOid: d.consumerAuthClient.oid,
        consumerClientOid: d.consumerClient.oid
      },
      update: {
        consumerClientOid: d.consumerClient.oid
      }
    });
  }

  async linkConsumerAuthClientToConsumerClient(d: {
    consumerAuthClient: Pick<
      ConsumerOAuthClient,
      'oid' | 'name' | 'redirectUris' | 'consumerAuthClientConsumerSurfaces'
    >;
  }) {
    let surfacesByOid = new Map(
      d.consumerAuthClient.consumerAuthClientConsumerSurfaces.map(ref => [
        ref.consumerSurface.oid,
        ref.consumerSurface
      ])
    );
    let consumerClients = await Promise.all(
      Array.from(surfacesByOid.values()).map(async surface => {
        let consumerClient = await this.upsertConsumerClient({
          consumerSurface: {
            oid: surface.oid,
            instanceOid: surface.instanceOid,
            organizationOid: surface.organizationOid
          },
          name: d.consumerAuthClient.name,
          redirectUris: d.consumerAuthClient.redirectUris
        });

        await this.ensureConsumerAuthClientConsumerSurface({
          consumerAuthClient: d.consumerAuthClient,
          consumerSurface: surface,
          consumerClient
        });

        return consumerClient;
      })
    );

    return consumerClients[0] ?? null;
  }

  async ensureConsumerAuthClientSurface(d: {
    consumerAuthClient: Pick<
      ConsumerOAuthClient,
      'oid' | 'instanceOid' | 'organizationOid' | 'name' | 'redirectUris'
    >;
    consumerSurface: Pick<ConsumerSurface, 'oid' | 'instanceOid' | 'organizationOid'>;
  }) {
    if (
      d.consumerAuthClient.instanceOid &&
      d.consumerAuthClient.instanceOid != d.consumerSurface.instanceOid
    ) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'OAuth client and consumer surface belong to different instances.'
        })
      );
    }

    if (
      d.consumerAuthClient.organizationOid &&
      d.consumerAuthClient.organizationOid != d.consumerSurface.organizationOid
    ) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'OAuth client and consumer surface belong to different organizations.'
        })
      );
    }

    let consumerClient = await this.upsertConsumerClient({
      consumerSurface: d.consumerSurface,
      name: d.consumerAuthClient.name,
      redirectUris: d.consumerAuthClient.redirectUris
    });

    await this.ensureConsumerAuthClientConsumerSurface({
      consumerAuthClient: d.consumerAuthClient,
      consumerSurface: d.consumerSurface,
      consumerClient
    });

    await db.consumerAuthClient.updateMany({
      where: {
        oid: d.consumerAuthClient.oid,
        OR: [{ instanceOid: null }, { organizationOid: null }]
      },
      data: {
        instanceOid: d.consumerSurface.instanceOid,
        organizationOid: d.consumerSurface.organizationOid
      }
    });
  }
}

export let consumerOAuthClientService = Service.create(
  'consumerOAuthClientService',
  () => new ConsumerOAuthClientService()
).build();
