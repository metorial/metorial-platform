import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  ProviderOAuthConnection,
  ProviderOAuthTakeIn,
  withTransaction
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Hash } from '@metorial/hash';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let getTokenHash = async (accessToken: string) =>
  `tkin*${await Hash.sha512('mtin1' + accessToken)}`;

let include = {
  connection: true,
  token: true,
  currentVersion: true
};

class OauthTakeInServiceImpl {
  async createOauthTakeIn(d: {
    instance: Instance;
    connection: ProviderOAuthConnection;
    context: Context;
    input: {
      note?: string;
      metadata?: Record<string, any>;
      accessToken: string;
      expiresAt?: Date;
      idToken?: string;
      scope?: string;
      tokenType?: string;
    };
  }) {
    return withTransaction(async db => {
      let token = await db.providerOAuthConnectionAuthToken.create({
        data: {
          id: await ID.generateId('providerOAuthTakeIn'),
          type: 'take_in',
          accessToken: d.input.accessToken,
          scope: d.input.scope,
          tokenType: d.input.tokenType,
          idToken: d.input.idToken,
          connectionOid: d.connection.oid
        }
      });

      let takeIn = await db.providerOAuthTakeIn.create({
        data: {
          id: await ID.generateId('providerOAuthTakeIn'),

          instanceOid: d.instance.oid,
          connectionOid: d.connection.oid,
          tokenOid: token.oid,

          metadata: d.input.metadata,
          note: d.input.note,

          expiresAt: d.input.expiresAt,

          currentVersionIndex: 1
        }
      });

      let version = await db.providerOAuthTakeInVersion.create({
        data: {
          id: await ID.generateId('providerOAuthTakeInVersion'),
          ip: d.context.ip,
          ua: d.context.ua,
          version: 1,
          expiresAt: d.input.expiresAt,
          tokenHash: await getTokenHash(d.input.accessToken),
          takeInOid: takeIn.oid
        }
      });

      return await db.providerOAuthTakeIn.update({
        where: { oid: takeIn.oid },
        data: { currentVersionOid: version.oid },
        include
      });
    });
  }

  async updateOauthTakeIn(d: {
    takeIn: ProviderOAuthTakeIn;
    context: Context;
    input: {
      note?: string;
      metadata?: Record<string, any>;
      accessToken?: string;
      expiresAt?: Date;
      idToken?: string;
      scope?: string;
      tokenType?: string;
    };
  }) {
    return withTransaction(async db => {
      if (
        d.input.accessToken ||
        d.input.expiresAt ||
        d.input.idToken ||
        d.input.scope ||
        d.input.tokenType
      ) {
        let updatedVersion = await db.providerOAuthTakeIn.update({
          where: {
            oid: d.takeIn.oid
          },
          data: {
            currentVersionIndex: {
              increment: 1
            }
          }
        });

        let updatedToken = await db.providerOAuthConnectionAuthToken.update({
          where: {
            oid: d.takeIn.oid
          },
          data: {
            accessToken: d.input.accessToken,
            expiresAt: d.input.expiresAt,
            tokenType: d.input.tokenType,
            idToken: d.input.idToken,
            scope: d.input.scope
          }
        });

        let version = await db.providerOAuthTakeInVersion.create({
          data: {
            id: await ID.generateId('providerOAuthTakeInVersion'),
            ip: d.context.ip,
            ua: d.context.ua,
            version: updatedVersion.currentVersionIndex,
            takeInOid: d.takeIn.oid,
            tokenHash: await getTokenHash(d.input.accessToken || updatedToken.accessToken),
            expiresAt: d.input.expiresAt
          }
        });

        await db.providerOAuthTakeIn.update({
          where: { oid: d.takeIn.oid },
          data: { currentVersionOid: version.oid }
        });
      }

      return await db.providerOAuthTakeIn.update({
        where: {
          oid: d.takeIn.oid
        },
        data: {
          note: d.input.note,
          metadata: d.input.metadata
        },
        include
      });
    });
  }

  async getTakeIn(d: { takeInId: string; instance: Instance }) {
    let connection = await db.providerOAuthTakeIn.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.takeInId
      },
      include
    });
    if (!connection) throw new ServiceError(notFoundError('connection'));

    return connection;
  }

  async listTakeIns(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerOAuthTakeIn.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid
            },
            include
          })
      )
    );
  }
}

export let providerOauthTakeInService = Service.create(
  'providerOauthTakeIn',
  () => new OauthTakeInServiceImpl()
).build();
