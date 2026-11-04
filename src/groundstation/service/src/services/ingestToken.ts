import { notFoundError, notImplementedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { ContentPolicy, IngestTokenLimits } from '@metorial/groundstation-spec';
import type { IngestToken, Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = { tenant: true };

type IngestTokenWithTenant = IngestToken & { tenant: Tenant };

class ingestTokenServiceImpl {
  async createIngestToken(_d: {
    tenant: Tenant;
    input: {
      name: string;
      principalRef?: string;
      contentPolicy?: ContentPolicy;
      limits?: IngestTokenLimits;
      allowedClients?: string[];
      allowedChannels?: string[];
      expiresAt?: Date;
    };
  }): Promise<{ ingestToken: IngestTokenWithTenant; secret: string }> {
    throw new ServiceError(notImplementedError());
  }

  async getIngestTokenById(d: { id: string; tenant: Tenant }) {
    let ingestToken = await db.ingestToken.findFirst({
      where: { id: d.id, tenantOid: d.tenant.oid },
      include
    });
    if (!ingestToken) throw new ServiceError(notFoundError('ingest_token'));

    return ingestToken;
  }

  async listIngestTokens(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ingestToken.findMany({
            ...opts,
            where: { tenantOid: d.tenant.oid },
            include
          })
      )
    );
  }

  async updateIngestToken(_d: {
    ingestToken: IngestTokenWithTenant;
    input: {
      name?: string;
      contentPolicy?: ContentPolicy;
      limits?: IngestTokenLimits;
      allowedClients?: string[];
      allowedChannels?: string[];
      expiresAt?: Date | null;
    };
  }): Promise<IngestTokenWithTenant> {
    throw new ServiceError(notImplementedError());
  }

  async revokeIngestToken(_d: {
    ingestToken: IngestTokenWithTenant;
  }): Promise<IngestTokenWithTenant> {
    throw new ServiceError(notImplementedError());
  }
}

export let ingestTokenService = Service.create(
  'ingestTokenService',
  () => new ingestTokenServiceImpl()
).build();
