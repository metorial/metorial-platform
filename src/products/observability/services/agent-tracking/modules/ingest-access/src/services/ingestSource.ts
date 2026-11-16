import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  defaultContentPolicy,
  defaultIngestTokenLimits,
  type ContentPolicy,
  type IngestChannel,
  type IngestTagInput,
  type IngestTokenLimits
} from '@mtsrc/agent-tracking-spec';
import type { IngestSource, Instance, Organization } from '@mtsrc/agent-tracking-db';
import { getCachedIngestCredential } from '../lib/tokenCache';
import { generateIngestSourceSecret, hashIngestTokenSecret } from '../lib/tokenSecret';
import { db } from '@mtsrc/agent-tracking-db';
import { getId } from '@mtsrc/agent-tracking-db';

let maxCreateAttempts = 5;

export let ingestSourceInclude = {
  organization: true,
  instance: { include: { project: true } }
} as const;

let isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code == 'P2002';

class IngestSourceServiceImpl {
  async createIngestSource(d: {
    organization: Organization;
    instance: Instance;
    input: {
      name: string;
      family: string;
      tags?: IngestTagInput[];

      contentPolicy?: ContentPolicy;
      limits?: IngestTokenLimits;
      allowedChannels?: IngestChannel[];
      newUserLimitPerDay?: number;
    };
  }) {
    for (let attempt = 1; ; attempt++) {
      let { prefix, secret, token } = generateIngestSourceSecret();

      try {
        let ingestSource = await db.ingestSource.create({
          data: {
            ...getId('ingestSource'),

            prefix,
            secretHash: await hashIngestTokenSecret(secret),

            name: d.input.name,
            family: d.input.family,
            tags: d.input.tags ?? [],

            contentPolicy: d.input.contentPolicy ?? defaultContentPolicy,
            limits: d.input.limits ?? defaultIngestTokenLimits,
            allowedChannels: d.input.allowedChannels ?? [],
            newUserLimitPerDay: d.input.newUserLimitPerDay,

            organizationOid: d.organization.oid,
            instanceOid: d.instance.oid
          },
          include: ingestSourceInclude
        });

        return { ingestSource, secret: token };
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= maxCreateAttempts) throw error;
      }
    }
  }

  async getIngestSourceById(d: { organization: Organization; ingestSourceId: string }) {
    let ingestSource = await db.ingestSource.findFirst({
      where: { id: d.ingestSourceId, organizationOid: d.organization.oid },
      include: ingestSourceInclude
    });
    if (!ingestSource) throw new ServiceError(notFoundError('ingest_source'));

    return ingestSource;
  }

  async listIngestSources(d: { organization: Organization; instance?: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ingestSource.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              instanceOid: d.instance?.oid
            },
            include: ingestSourceInclude
          })
      )
    );
  }

  async updateIngestSource(d: {
    ingestSource: IngestSource;
    input: {
      name?: string;
      contentPolicy?: ContentPolicy;
      limits?: IngestTokenLimits;
      allowedChannels?: IngestChannel[];
      newUserLimitPerDay?: number;
    };
  }) {
    this.assertIngestSourceActive(d.ingestSource);

    let ingestSource = await db.ingestSource.update({
      where: { oid: d.ingestSource.oid },
      data: {
        name: d.input.name,
        contentPolicy: d.input.contentPolicy,
        limits: d.input.limits,
        allowedChannels: d.input.allowedChannels,
        newUserLimitPerDay: d.input.newUserLimitPerDay
      },
      include: ingestSourceInclude
    });

    await getCachedIngestCredential.clearAndWait({
      kind: 'source',
      prefix: ingestSource.prefix
    });

    return ingestSource;
  }

  async rotateIngestSource(d: { ingestSource: IngestSource }) {
    this.assertIngestSourceActive(d.ingestSource);

    for (let attempt = 1; ; attempt++) {
      let { prefix, secret, token } = generateIngestSourceSecret();

      try {
        let ingestSource = await db.ingestSource.update({
          where: { oid: d.ingestSource.oid },
          data: { prefix, secretHash: await hashIngestTokenSecret(secret) },
          include: ingestSourceInclude
        });

        await getCachedIngestCredential.clearAndWait({
          kind: 'source',
          prefix: d.ingestSource.prefix
        });

        return { ingestSource, secret: token };
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= maxCreateAttempts) throw error;
      }
    }
  }

  async revokeIngestSource(d: { ingestSource: IngestSource }) {
    let ingestSource = d.ingestSource.revokedAt
      ? await db.ingestSource.findUniqueOrThrow({
          where: { oid: d.ingestSource.oid },
          include: ingestSourceInclude
        })
      : await db.ingestSource.update({
          where: { oid: d.ingestSource.oid },
          data: { revokedAt: new Date() },
          include: ingestSourceInclude
        });

    await getCachedIngestCredential.clearAndWait({
      kind: 'source',
      prefix: ingestSource.prefix
    });

    return ingestSource;
  }

  private assertIngestSourceActive(ingestSource: IngestSource) {
    if (ingestSource.revokedAt) {
      throw new ServiceError(
        preconditionFailedError({ message: 'A revoked ingest source cannot be changed.' })
      );
    }
  }
}

export let ingestSourceService = Service.create(
  'ingestSourceService',
  () => new IngestSourceServiceImpl()
).build();
