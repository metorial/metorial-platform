import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  AuditLogStream,
  AuditLogStreamStatus,
  db,
  ID,
  Organization,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { AuditLogStreamProvider, sanitizeAuditLogStreamProviderData } from '../destinations';
import { markAuditLogOrganizationDirty } from '../lib/dirty';
import { encryptAuditLogStreamProviderData } from '../lib/providerData';

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
    auditScope: AuditScope;
    input: {
      provider: AuditLogStreamProvider;
      providerData: Record<string, unknown>;
    };
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.audit_log_stream.created:before', {
        organization: d.organization,
        auditScope: d.auditScope,
        input: { provider: d.input.provider }
      });

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
      await markAuditLogOrganizationDirty(d.organization.oid, db);

      await Fabric.fire('organization.audit_log_stream.created:after', {
        organization: d.organization,
        auditScope: d.auditScope,
        auditLogStream: stream,
        input: { provider: d.input.provider }
      });

      return stream;
    });
  }

  async updateAuditLogStream(d: {
    organization: Organization;
    auditLogStream: AuditLogStream;
    auditScope: AuditScope;
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
      await Fabric.fire('organization.audit_log_stream.updated:before', {
        organization: d.organization,
        auditScope: d.auditScope,
        auditLogStream: d.auditLogStream,
        input: {
          provider: d.input.provider,
          status: d.input.status
        }
      });

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
      if (d.auditLogStream.status === 'inactive' && stream.status === 'active') {
        await db.auditLogStreamEvent.create({
          data: {
            id: await ID.generateId('auditLogStreamEvent'),
            type: 'enabled',
            auditLogStreamOid: stream.oid
          }
        });
        await markAuditLogOrganizationDirty(stream.organizationOid, db);
      }

      await Fabric.fire('organization.audit_log_stream.updated:after', {
        organization: d.organization,
        auditScope: d.auditScope,
        auditLogStream: stream,
        previousAuditLogStream: d.auditLogStream,
        input: {
          provider: d.input.provider,
          status: d.input.status
        }
      });

      return stream;
    });
  }

  async resumeAuditLogStream(d: {
    organization: Organization;
    auditLogStream: AuditLogStream;
    auditScope: AuditScope;
  }) {
    if (!d.auditLogStream.isPausedDueToError) {
      throw new ServiceError(
        badRequestError({
          message: 'Audit log stream is not paused due to errors'
        })
      );
    }

    return withTransaction(async db => {
      await Fabric.fire('organization.audit_log_stream.resumed:before', {
        organization: d.organization,
        auditScope: d.auditScope,
        auditLogStream: d.auditLogStream
      });

      let stream = await db.auditLogStream.update({
        where: { oid: d.auditLogStream.oid },
        data: {
          isPausedDueToError: false,
          consecutiveErrorCount: 0
        }
      });
      await markAuditLogOrganizationDirty(stream.organizationOid, db);

      await Fabric.fire('organization.audit_log_stream.resumed:after', {
        organization: d.organization,
        auditScope: d.auditScope,
        auditLogStream: stream,
        previousAuditLogStream: d.auditLogStream
      });

      return stream;
    });
  }

  async deleteAuditLogStream(d: {
    organization: Organization;
    auditLogStream: AuditLogStream;
    auditScope: AuditScope;
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.audit_log_stream.deleted:before', {
        organization: d.organization,
        auditScope: d.auditScope,
        auditLogStream: d.auditLogStream
      });

      let stream = await db.auditLogStream.delete({
        where: { oid: d.auditLogStream.oid }
      });

      await Fabric.fire('organization.audit_log_stream.deleted:after', {
        organization: d.organization,
        auditScope: d.auditScope,
        auditLogStream: stream
      });

      return stream;
    });
  }
}

export let auditLogStreamService = Service.create(
  'auditLogStreamService',
  () => new AuditLogStreamService()
).build();
