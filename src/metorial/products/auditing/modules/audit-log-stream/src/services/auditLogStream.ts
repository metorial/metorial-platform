import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  AuditLogStream,
  AuditLogStreamStatus,
  db,
  ID,
  Organization,
  withTransaction
} from '@metorial/db';
import { encryptAuditLogStreamProviderData } from '../providerData';
import type { AuditLogStreamProvider } from '../providers';

class AuditLogStreamService {
  async listAuditLogStreams(d: { organization: Organization }) {
    return Paginator.create(
      ({ prisma }) =>
        prisma(async opts =>
          db.auditLogStream.findMany({
            ...opts,
            where: { organizationOid: d.organization.oid }
          })
        ),
      { defaultOrder: 'desc' }
    );
  }

  async createAuditLogStream(d: {
    organization: Organization;
    input: {
      provider: AuditLogStreamProvider;
      providerData: Record<string, unknown>;
    };
  }) {
    return withTransaction(async db => {
      let streamId = await ID.generateId('auditLogStream');
      let { encryptedProviderData } = await encryptAuditLogStreamProviderData({
        streamId,
        provider: d.input.provider,
        providerData: d.input.providerData
      });
      let stream = await db.auditLogStream.create({
        data: {
          id: streamId,
          provider: d.input.provider,
          status: 'active',
          accessStatus: 'ok',
          organizationOid: d.organization.oid,
          encryptedProviderData
        }
      });

      await db.auditLogStreamEvent.create({
        data: {
          id: await ID.generateId('auditLogStreamEvent'),
          type: 'created',
          auditLogStreamOid: stream.oid
        }
      });

      return stream;
    });
  }

  async updateAuditLogStream(d: {
    auditLogStream: AuditLogStream;
    input: {
      provider?: AuditLogStreamProvider;
      providerData?: Record<string, unknown>;
      status?: AuditLogStreamStatus;
    };
  }) {
    let provider = d.input.provider ?? d.auditLogStream.provider;
    if (provider !== d.auditLogStream.provider && d.input.providerData === undefined) {
      throw new ServiceError(
        badRequestError({
          message: 'providerData is required when changing provider'
        })
      );
    }

    let encryptedProviderData: string | undefined;
    if (d.input.providerData !== undefined) {
      encryptedProviderData = (
        await encryptAuditLogStreamProviderData({
          streamId: d.auditLogStream.id,
          provider,
          providerData: d.input.providerData
        })
      ).encryptedProviderData;
    }

    return withTransaction(async db => {
      let stream = await db.auditLogStream.update({
        where: { oid: d.auditLogStream.oid },
        data: {
          provider: d.input.provider,
          status: d.input.status,
          encryptedProviderData
        }
      });

      if (d.auditLogStream.status !== 'inactive' && stream.status === 'inactive') {
        await db.auditLogStreamEvent.create({
          data: {
            id: await ID.generateId('auditLogStreamEvent'),
            type: 'disabled',
            auditLogStreamOid: stream.oid
          }
        });
      }

      return stream;
    });
  }

  async deleteAuditLogStream(d: { auditLogStream: AuditLogStream }) {
    return db.auditLogStream.delete({
      where: { oid: d.auditLogStream.oid }
    });
  }
}

export let auditLogStreamService = Service.create(
  'auditLogStreamService',
  () => new AuditLogStreamService()
).build();
