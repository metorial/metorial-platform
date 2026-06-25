import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  DelegatedOAuthConfig,
  DelegatedOAuthConnection,
  Secret,
  Tenant
} from '../../../../prisma/generated/client';
import { db } from '../../../db';
import { getId } from '../../../id';
import { withTransaction } from '../../../transaction';
import { secretService } from '../../secret';

let include = {
  serverOAuthCredentials: true
};

class delegatedOAuthConnectionServiceImpl {
  async createConnection(d: {
    tenant: Tenant;

    input: {
      config: DelegatedOAuthConfig;

      clientId: string;
      clientSecret: string;
    };
  }) {
    let secret: Secret | undefined = undefined;
    if (d.input.clientId) {
      secret = await secretService.createSecret({
        tenant: d.tenant,
        purpose: 'oauth_connection_credentials',
        secretData: {
          clientId: d.input.clientId,
          clientSecret: d.input.clientSecret
        }
      });
    }

    return await withTransaction(async db => {
      let con = await db.delegatedOAuthConnection.create({
        data: {
          ...getId('delegatedOAuthConnection'),

          status: 'active',

          clientId: d.input.clientId,

          secretOid: secret?.oid,
          tenantOid: d.tenant.oid,
          configOid: d.input.config.oid,
          serverOid: d.input.config.serverOid,
          functionServerOid: d.input.config.functionServerOid
        }
      });

      await db.serverOAuthCredentials.createMany({
        data: {
          ...getId('serverOAuthCredentials'),
          type: 'delegated',
          delegatedConnectionOid: con.oid,
          serverOid: d.input.config.serverOid,
          tenantOid: d.tenant.oid
        }
      });

      return await db.delegatedOAuthConnection.findUniqueOrThrow({
        where: { oid: con.oid },
        include
      });
    });
  }

  async listConnectionEvents(d: { connection: DelegatedOAuthConnection }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.delegatedOAuthConnectionEvent.findMany({
            ...opts,
            where: {
              connectionOid: d.connection.oid
            },
            include: {
              connection: true
            }
          })
      )
    );
  }

  async getConnectionEventById(d: { connection: DelegatedOAuthConnection; eventId: string }) {
    let event = await db.delegatedOAuthConnectionEvent.findUnique({
      where: { id: d.eventId, connectionOid: d.connection.oid },
      include: { connection: true }
    });
    if (!event) throw new ServiceError(notFoundError('connection_event', d.eventId));

    return event;
  }

  async DANGEROUSLY_getCredentials(d: {
    tenant: Tenant;
    connection: DelegatedOAuthConnection;
    omitSecret?: boolean;
  }) {
    if (d.connection.secretOid && !d.omitSecret) {
      let secret = await secretService.DANGEROUSLY_decryptSecret({
        secretOid: d.connection.secretOid,
        purpose: 'oauth_connection_credentials',
        tenant: d.tenant,
        note: `docn.cred:${d.connection.id}`
      });

      return {
        clientId: secret.clientId,
        clientSecret: secret.clientSecret
      };
    }

    if (d.connection.clientId) {
      return {
        clientId: d.connection.clientId,
        clientSecret: undefined
      };
    }

    throw new ServiceError(
      badRequestError({
        message: 'Connection is not properly configured for authentication'
      })
    );
  }
}

export let delegatedOAuthConnectionService = Service.create(
  'delegatedOAuthConnection',
  () => new delegatedOAuthConnectionServiceImpl()
).build();
