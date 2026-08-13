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
import { encryptAuditLogStreamProviderData } from '../lib/providerData';
import { AuditLogStreamProvider, sanitizeAuditLogStreamProviderData } from '../providers';

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
      let { encryptedProviderData, providerData } = await encryptAuditLogStreamProviderData({
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
          providerDataRedacted: sanitizeAuditLogStreamProviderData(
            d.input.provider,
            providerData
          ),
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

    let providerDataRedacted: Record<string, string> | undefined;
    let encryptedProviderData: string | undefined;
    if (d.input.providerData !== undefined) {
      let encrypted = await encryptAuditLogStreamProviderData({
        streamId: d.auditLogStream.id,
        provider,
        providerData: d.input.providerData
      });
      providerDataRedacted = sanitizeAuditLogStreamProviderData(
        provider,
        encrypted.providerData
      );
      encryptedProviderData = encrypted.encryptedProviderData;
    }

    return withTransaction(async db => {
      let stream = await db.auditLogStream.update({
        where: { oid: d.auditLogStream.oid },
        data: {
          provider: d.input.provider,
          status: d.input.status,
          providerDataRedacted,
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
