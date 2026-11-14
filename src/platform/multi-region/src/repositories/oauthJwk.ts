import { Service } from '@lowerdeck/service';
import { generateCustomId } from '@metorial/id';
import { cell } from '../cell';
import { globalDB, OAuthJwkStatus, Prisma } from '../db';

let oauthJwkOrder = [{ status: 'asc' as const }, { activatesAt: 'asc' as const }];

class OAuthJwkGlobalRepository {
  async listOAuthJwks() {
    return await globalDB.oAuthJwk.findMany({
      orderBy: oauthJwkOrder
    });
  }

  async createOAuthJwk(d: {
    kid: string;
    status: OAuthJwkStatus;
    alg: string;
    use: string;
    kty: string;
    crv?: string | null;
    publicJwk: Prisma.InputJsonValue;
    privateJwk: Prisma.InputJsonValue;
    activatesAt: Date;
    expiresAt: Date;
  }) {
    return await globalDB.oAuthJwk.create({
      data: {
        id: generateCustomId('mt_oaky', 32),
        kid: d.kid,
        status: d.status,
        alg: d.alg,
        use: d.use,
        kty: d.kty,
        crv: d.crv ?? null,
        publicJwk: d.publicJwk,
        privateJwk: d.privateJwk,
        activatesAt: d.activatesAt,
        expiresAt: d.expiresAt,
        generatedByOid: (await cell).oid
      }
    });
  }

  async updateOAuthJwkStatus(d: {
    id: string;
    status: OAuthJwkStatus;
    retiredAt?: Date | null;
  }) {
    return await globalDB.oAuthJwk.update({
      where: {
        id: d.id
      },
      data: {
        status: d.status,
        retiredAt: d.retiredAt ?? null
      }
    });
  }

  async deleteOAuthJwk(d: { id: string }) {
    return await globalDB.oAuthJwk.delete({
      where: {
        id: d.id
      }
    });
  }

  async getPublicOAuthJwks() {
    return await globalDB.oAuthJwk.findMany({
      where: {
        status: {
          in: ['active', 'next']
        }
      },
      orderBy: oauthJwkOrder,
      select: {
        kid: true,
        alg: true,
        use: true,
        kty: true,
        crv: true,
        publicJwk: true,
        activatesAt: true,
        expiresAt: true,
        status: true
      }
    });
  }
}

export let oauthJwkGlobalRepository = Service.create(
  'oauthJwkGlobalRepository',
  () => new OAuthJwkGlobalRepository()
).build();
