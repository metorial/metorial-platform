import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, ID, type ConsumerSurface, type TransactionDB } from '@metorial/db';
import { getConsumerClientHash, normalizeConsumerClientRedirectUris } from './_helpers';
import { ConsumerOAuthClient } from './_types';

class ConsumerOAuthClientService {
  async upsertConsumerClient(d: {
    consumerSurface: Pick<ConsumerSurface, 'oid' | 'instanceOid' | 'organizationOid'>;
    name: string;
    redirectUris: string[];
    db?: TransactionDB;
  }) {
    let tx = d.db ?? db;
    let redirectUris = normalizeConsumerClientRedirectUris(d.redirectUris);
    let hash = await getConsumerClientHash({
      name: d.name,
      redirectUris
    });

    let consumerClient = await tx.consumerClient.findFirst({
      where: {
        hash,
        consumerSurfaceOid: d.consumerSurface.oid
      }
    });

    if (!consumerClient) {
      return await tx.consumerClient.create({
        data: {
          id: await ID.generateId('consumerClient'),
          instanceOid: d.consumerSurface.instanceOid,
          organizationOid: d.consumerSurface.organizationOid,
          consumerSurfaceOid: d.consumerSurface.oid,
          hash,
          name: d.name,
          redirectUris
        }
      });
    }

    return await tx.consumerClient.update({
      where: {
        oid: consumerClient.oid
      },
      data: {
        name: d.name,
        redirectUris,
        instanceOid: d.consumerSurface.instanceOid,
        organizationOid: d.consumerSurface.organizationOid,
        consumerSurfaceOid: d.consumerSurface.oid
      }
    });
  }

  async ensureConsumerAuthClientSurfaceRef(d: {
    consumerAuthClient: Pick<ConsumerOAuthClient, 'oid'>;
    consumerSurface: Pick<ConsumerSurface, 'oid'>;
    consumerClient: { oid: bigint };
    db?: TransactionDB;
  }) {
    let tx = d.db ?? db;

    return await tx.consumerAuthClientSurface.upsert({
      where: {
        consumerSurfaceOid_consumerAuthClientOid: {
          consumerSurfaceOid: d.consumerSurface.oid,
          consumerAuthClientOid: d.consumerAuthClient.oid
        }
      },
      create: {
        id: await ID.generateId('consumerAuthClientSurface'),
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
      'oid' | 'name' | 'redirectUris' | 'consumerAuthClientSurfaces'
    >;
  }) {
    let surfacesByOid = new Map(
      d.consumerAuthClient.consumerAuthClientSurfaces.map(ref => [
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

        await this.ensureConsumerAuthClientSurfaceRef({
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
    db?: TransactionDB;
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
      redirectUris: d.consumerAuthClient.redirectUris,
      db: d.db
    });

    await this.ensureConsumerAuthClientSurfaceRef({
      consumerAuthClient: d.consumerAuthClient,
      consumerSurface: d.consumerSurface,
      consumerClient,
      db: d.db
    });

    let tx = d.db ?? db;

    await tx.consumerAuthClient.updateMany({
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
