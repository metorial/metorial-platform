import { Context } from '@metorial/context';
import { db, ID, Instance } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { providerOauthAuthorizationService } from './oauthAuthorization';

let include = {
  token: true
};

class OauthTakeoutServiceImpl {
  async createOauthTakeout(d: {
    instance: Instance;
    from:
      | {
          type: 'token';
          token: { oid: bigint };
        }
      | {
          type: 'reference';
          referenceOid: bigint;
        };
    input: {
      note?: string;
      metadata?: Record<string, any>;
    };
    context: Context;
  }) {
    let authRes = await providerOauthAuthorizationService.useAuthToken({
      instance: d.instance,
      ...(d.from.type === 'token'
        ? { tokenOid: d.from.token.oid }
        : { referenceOid: d.from.referenceOid })
    });

    return await db.providerOAuthTakeout.create({
      data: {
        id: await ID.generateId('providerOAuthTakeout'),

        instanceOid: d.instance.oid,
        connectionOid: authRes.connection.oid,
        tokenOid: authRes.token.oid,
        metadata: d.input.metadata,

        note: d.input.note,
        ip: d.context.ip,
        ua: d.context.ua,
        expiresAt: authRes.expiresAt
      },
      include
    });
  }

  async getTakeout(d: { takeoutId: string; instance: Instance }) {
    let connection = await db.providerOAuthTakeout.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.takeoutId
      },
      include
    });
    if (!connection) throw new ServiceError(notFoundError('connection'));

    return connection;
  }

  async listTakeouts(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerOAuthTakeout.findMany({
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

export let providerOauthTakeoutService = Service.create(
  'providerOauthTakeout',
  () => new OauthTakeoutServiceImpl()
).build();
