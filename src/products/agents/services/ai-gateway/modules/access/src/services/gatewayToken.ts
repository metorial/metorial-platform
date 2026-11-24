import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type GatewayToken,
  type Instance,
  type Organization
} from '@mtsrc/ai-gateway-db';
import {
  defaultGatewayTokenLimits,
  maxTokenMetadataEntries,
  type GatewayTokenLimits,
  type GatewayTokenMetadata
} from '@mtsrc/ai-gateway-spec';
import { getCachedGatewayToken } from '../lib/tokenCache';
import { generateGatewayToken, hashGatewayTokenSecret } from '../lib/tokenSecret';

let maxCreateAttempts = 5;

export let gatewayTokenInclude = {
  instance: { include: { project: true } }
} as const;

let isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code == 'P2002';

let badRequest = (message: string) => new ServiceError(badRequestError({ message }));

class GatewayTokenServiceImpl {
  async createGatewayToken(d: {
    organization: Organization;
    instance: Instance;
    input: {
      name: string;
      consumerRef?: string;
      allowedModels?: string[];
      limits?: GatewayTokenLimits;
      metadata?: GatewayTokenMetadata;
      expiresAt?: Date;
    };
  }) {
    this.assertExpiryInFuture(d.input.expiresAt);
    this.assertMetadataSize(d.input.metadata);

    for (let attempt = 1; ; attempt++) {
      let { prefix, secret, token } = generateGatewayToken();

      try {
        let gatewayToken = await db.gatewayToken.create({
          data: {
            ...getId('gatewayToken'),

            prefix,
            secretHash: await hashGatewayTokenSecret(secret),

            name: d.input.name,
            consumerRef: d.input.consumerRef?.trim() || undefined,

            allowedModels: normalizeModelList(d.input.allowedModels),
            limits: d.input.limits ?? defaultGatewayTokenLimits,
            metadata: d.input.metadata ?? {},

            expiresAt: d.input.expiresAt,

            organizationOid: d.organization.oid,
            instanceOid: d.instance.oid
          },
          include: gatewayTokenInclude
        });

        return { gatewayToken, secret: token };
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= maxCreateAttempts) throw error;
      }
    }
  }

  async getGatewayTokenById(d: { organization: Organization; gatewayTokenId: string }) {
    let gatewayToken = await db.gatewayToken.findFirst({
      where: { id: d.gatewayTokenId, organizationOid: d.organization.oid },
      include: gatewayTokenInclude
    });
    if (!gatewayToken) throw new ServiceError(notFoundError('gateway_token'));

    return gatewayToken;
  }

  async listGatewayTokens(d: {
    organization: Organization;
    instance?: Instance;
    consumerRef?: string;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.gatewayToken.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              instanceOid: d.instance?.oid,
              consumerRef: d.consumerRef
            },
            include: gatewayTokenInclude
          })
      )
    );
  }

  async updateGatewayToken(d: {
    gatewayToken: GatewayToken;
    input: {
      name?: string;
      allowedModels?: string[];
      limits?: GatewayTokenLimits;
      metadata?: GatewayTokenMetadata;
      expiresAt?: Date | null;
    };
  }) {
    if (d.gatewayToken.revokedAt) {
      throw new ServiceError(
        preconditionFailedError({ message: 'A revoked gateway token cannot be updated.' })
      );
    }

    if (d.input.expiresAt) this.assertExpiryInFuture(d.input.expiresAt);
    this.assertMetadataSize(d.input.metadata);

    let gatewayToken = await db.gatewayToken.update({
      where: { oid: d.gatewayToken.oid },
      data: {
        name: d.input.name,
        allowedModels: d.input.allowedModels && normalizeModelList(d.input.allowedModels),
        limits: d.input.limits,
        metadata: d.input.metadata,
        expiresAt: d.input.expiresAt
      },
      include: gatewayTokenInclude
    });

    await getCachedGatewayToken.clearAndWait({ prefix: gatewayToken.prefix });

    return gatewayToken;
  }

  async revokeGatewayToken(d: { gatewayToken: GatewayToken }) {
    let gatewayToken = d.gatewayToken.revokedAt
      ? await db.gatewayToken.findUniqueOrThrow({
          where: { oid: d.gatewayToken.oid },
          include: gatewayTokenInclude
        })
      : await db.gatewayToken.update({
          where: { oid: d.gatewayToken.oid },
          data: { revokedAt: new Date() },
          include: gatewayTokenInclude
        });

    await getCachedGatewayToken.clearAndWait({ prefix: gatewayToken.prefix });

    return gatewayToken;
  }

  private assertExpiryInFuture(expiresAt: Date | undefined) {
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw badRequest('The expiry of a gateway token must be in the future.');
    }
  }

  private assertMetadataSize(metadata: GatewayTokenMetadata | undefined) {
    if (metadata && Object.keys(metadata).length > maxTokenMetadataEntries) {
      throw badRequest(
        `A gateway token can carry at most ${maxTokenMetadataEntries} metadata entries.`
      );
    }
  }
}

let normalizeModelList = (models: string[] | undefined) => [
  ...new Set((models ?? []).map(model => model.trim()).filter(Boolean))
];

export let gatewayTokenService = Service.create(
  'gatewayTokenService',
  () => new GatewayTokenServiceImpl()
).build();
