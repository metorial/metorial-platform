import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  defaultContentPolicy,
  defaultIngestTokenLimits,
  type ContentPolicy,
  type IngestChannel,
  type IngestTokenLimits
} from '@metorial/groundstation-spec';
import type { IngestToken, Tenant } from '../../prisma/generated/client';
import { getCachedIngestToken } from '../auth/tokenCache';
import { generateIngestToken, hashIngestTokenSecret } from '../auth/tokenSecret';
import { db } from '../db';
import { getId } from '../id';

let maxCreateAttempts = 5;

let include = { tenant: true };

let isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code == 'P2002';

type IngestTokenWithTenant = IngestToken & { tenant: Tenant };

class ingestTokenServiceImpl {
  async createIngestToken(d: {
    tenant: Tenant;
    input: {
      name: string;
      principalRef?: string;
      contentPolicy?: ContentPolicy;
      limits?: IngestTokenLimits;
      allowedClients?: string[];
      allowedChannels?: IngestChannel[];
      expiresAt?: Date;
    };
  }) {
    this.assertExpiryInFuture(d.input.expiresAt);

    for (let attempt = 1; ; attempt++) {
      let { prefix, secret, token } = generateIngestToken();

      try {
        let ingestToken = await db.ingestToken.create({
          data: {
            ...getId('ingestToken'),

            prefix,
            secretHash: await hashIngestTokenSecret(secret),

            name: d.input.name,
            principalRef: d.input.principalRef,

            contentPolicy: d.input.contentPolicy ?? defaultContentPolicy,
            limits: d.input.limits ?? defaultIngestTokenLimits,
            allowedClients: d.input.allowedClients ?? [],
            allowedChannels: d.input.allowedChannels ?? [],

            expiresAt: d.input.expiresAt,

            tenantOid: d.tenant.oid
          },
          include
        });

        return { ingestToken, secret: token };
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= maxCreateAttempts) throw error;
      }
    }
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

  async updateIngestToken(d: {
    ingestToken: IngestTokenWithTenant;
    input: {
      name?: string;
      contentPolicy?: ContentPolicy;
      limits?: IngestTokenLimits;
      allowedClients?: string[];
      allowedChannels?: IngestChannel[];
      expiresAt?: Date | null;
    };
  }) {
    if (d.ingestToken.revokedAt) {
      throw new ServiceError(
        preconditionFailedError({ message: 'A revoked ingest token cannot be updated.' })
      );
    }

    if (d.input.expiresAt) this.assertExpiryInFuture(d.input.expiresAt);

    let ingestToken = await db.ingestToken.update({
      where: { oid: d.ingestToken.oid },
      data: {
        name: d.input.name,
        contentPolicy: d.input.contentPolicy,
        limits: d.input.limits,
        allowedClients: d.input.allowedClients,
        allowedChannels: d.input.allowedChannels,
        expiresAt: d.input.expiresAt
      },
      include
    });

    await getCachedIngestToken.clearAndWait({ prefix: ingestToken.prefix });

    return ingestToken;
  }

  async revokeIngestToken(d: { ingestToken: IngestTokenWithTenant }) {
    if (d.ingestToken.revokedAt) return d.ingestToken;

    let ingestToken = await db.ingestToken.update({
      where: { oid: d.ingestToken.oid },
      data: { revokedAt: new Date() },
      include
    });

    await getCachedIngestToken.clearAndWait({ prefix: ingestToken.prefix });

    return ingestToken;
  }

  private assertExpiryInFuture(expiresAt: Date | undefined) {
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new ServiceError(
        badRequestError({ message: 'The expiry of an ingest token must be in the future.' })
      );
    }
  }
}

export let ingestTokenService = Service.create(
  'ingestTokenService',
  () => new ingestTokenServiceImpl()
).build();
