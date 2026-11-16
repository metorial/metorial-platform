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
  type IngestDeviceMode,
  type IngestTagInput,
  type IngestTokenLimits
} from '@mtsrc/agent-tracking-spec';
import type { IngestToken, Instance, Organization } from '@mtsrc/agent-tracking-db';
import { getCachedIngestCredential } from '../lib/tokenCache';
import { generateIngestToken, hashIngestTokenSecret } from '../lib/tokenSecret';
import { db } from '@mtsrc/agent-tracking-db';
import { ensureEntityStub } from '@mtsrc/agent-tracking-module-entities';
import { getId } from '@mtsrc/agent-tracking-db';

let maxCreateAttempts = 5;

export let ingestTokenInclude = {
  organization: true,
  instance: { include: { project: true } },
  userEntity: true,
  deviceEntity: true,
  agentEntity: true
} as const;

let isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code == 'P2002';

let badRequest = (message: string) => new ServiceError(badRequestError({ message }));

class IngestTokenServiceImpl {
  async createIngestToken(d: {
    organization: Organization;
    instance: Instance;
    input: {
      name: string;

      userRef: string;
      deviceRef?: string;
      deviceMode?: IngestDeviceMode;
      agentRef?: string;
      tags?: IngestTagInput[];

      contentPolicy?: ContentPolicy;
      limits?: IngestTokenLimits;
      allowedClients?: string[];
      allowedChannels?: IngestChannel[];
      expiresAt?: Date;
    };
  }) {
    let binding = this.resolveBinding(d.input);
    this.assertExpiryInFuture(d.input.expiresAt);

    let userEntity = await ensureEntityStub({
      organization: d.organization,
      kind: 'user',
      source: 'metorial.consumer',
      ref: binding.userRef
    });
    let deviceEntity = binding.deviceRef
      ? await ensureEntityStub({
          organization: d.organization,
          kind: 'device',
          source: 'metorial.device',
          ref: binding.deviceRef
        })
      : null;
    let agentEntity = binding.agentRef
      ? await ensureEntityStub({
          organization: d.organization,
          kind: 'agent',
          source: 'metorial.client',
          ref: binding.agentRef
        })
      : null;

    for (let attempt = 1; ; attempt++) {
      let { prefix, secret, token } = generateIngestToken();

      try {
        let ingestToken = await db.ingestToken.create({
          data: {
            ...getId('ingestToken'),

            prefix,
            secretHash: await hashIngestTokenSecret(secret),

            name: d.input.name,

            userRef: binding.userRef,
            deviceRef: binding.deviceRef,
            deviceMode: binding.deviceMode,
            agentRef: binding.agentRef,
            tags: d.input.tags ?? [],

            contentPolicy: d.input.contentPolicy ?? defaultContentPolicy,
            limits: d.input.limits ?? defaultIngestTokenLimits,
            allowedClients: d.input.allowedClients ?? [],
            allowedChannels: d.input.allowedChannels ?? [],

            expiresAt: d.input.expiresAt,

            organizationOid: d.organization.oid,
            instanceOid: d.instance.oid,
            userEntityOid: userEntity.oid,
            deviceEntityOid: deviceEntity?.oid,
            agentEntityOid: agentEntity?.oid
          },
          include: ingestTokenInclude
        });

        return { ingestToken, secret: token };
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= maxCreateAttempts) throw error;
      }
    }
  }

  async getIngestTokenById(d: { organization: Organization; ingestTokenId: string }) {
    let ingestToken = await db.ingestToken.findFirst({
      where: { id: d.ingestTokenId, organizationOid: d.organization.oid },
      include: ingestTokenInclude
    });
    if (!ingestToken) throw new ServiceError(notFoundError('ingest_token'));

    return ingestToken;
  }

  async listIngestTokens(d: { organization: Organization; instance?: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ingestToken.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              instanceOid: d.instance?.oid
            },
            include: ingestTokenInclude
          })
      )
    );
  }

  async updateIngestToken(d: {
    ingestToken: IngestToken;
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
      include: ingestTokenInclude
    });

    await getCachedIngestCredential.clearAndWait({
      kind: 'token',
      prefix: ingestToken.prefix
    });

    return ingestToken;
  }

  async revokeIngestToken(d: { ingestToken: IngestToken }) {
    let ingestToken = d.ingestToken.revokedAt
      ? await db.ingestToken.findUniqueOrThrow({
          where: { oid: d.ingestToken.oid },
          include: ingestTokenInclude
        })
      : await db.ingestToken.update({
          where: { oid: d.ingestToken.oid },
          data: { revokedAt: new Date() },
          include: ingestTokenInclude
        });

    await getCachedIngestCredential.clearAndWait({
      kind: 'token',
      prefix: ingestToken.prefix
    });

    return ingestToken;
  }

  private resolveBinding(input: {
    userRef: string;
    deviceRef?: string;
    deviceMode?: IngestDeviceMode;
    agentRef?: string;
  }) {
    let userRef = input.userRef.trim();
    let deviceRef = input.deviceRef?.trim() || undefined;
    let agentRef = input.agentRef?.trim() || undefined;

    if (!userRef) throw badRequest('An ingest token must be bound to a user (userRef).');

    if (input.deviceMode == 'ephemeral') {
      if (deviceRef) {
        throw badRequest(
          'An ingest token with ephemeral devices cannot also set a deviceRef.'
        );
      }

      return { userRef, deviceMode: 'ephemeral' as const, agentRef };
    }

    if (!deviceRef) {
      throw badRequest(
        'An ingest token must be bound to a device (deviceRef) or use deviceMode "ephemeral".'
      );
    }

    return { userRef, deviceRef, deviceMode: 'bound' as const, agentRef };
  }

  private assertExpiryInFuture(expiresAt: Date | undefined) {
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw badRequest('The expiry of an ingest token must be in the future.');
    }
  }
}

export let ingestTokenService = Service.create(
  'ingestTokenService',
  () => new IngestTokenServiceImpl()
).build();
