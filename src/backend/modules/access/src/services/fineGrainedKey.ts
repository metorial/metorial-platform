import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { UnifiedApiKey } from '@metorial/api-keys';
import { getConfig } from '@metorial/config';
import { Context } from '@metorial/context';
import { AccessTag, db, FineGrainedKey, ID, Instance, withTransaction } from '@metorial/db';

let includeFineGrainedKey = {
  instance: { include: { project: true, organization: true } },
  accessTag: true
} as const;

class FineGrainedKeyService {
  private async ensureFineGrainedKeyActive(fineGrainedKey: FineGrainedKey) {
    if (fineGrainedKey.status != 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on an inactive fine grained key'
        })
      );
    }
  }

  async createFineGrainedKey(d: {
    input: {
      expiresAt?: Date;
    };
    context?: Context;
    instance: Instance;
    accessTag: AccessTag;
  }) {
    if (d.accessTag.instanceOid != d.instance.oid) {
      throw new ServiceError(
        forbiddenError({
          message: 'Access tag must belong to the same instance as the fine grained key'
        })
      );
    }

    return await withTransaction(async db => {
      let secretKey = UnifiedApiKey.create({
        type: 'fine_grained_token',
        config: { url: getConfig().urls.apiUrl, instance: 'v2-us1' }
      });

      let fineGrainedKey = await db.fineGrainedKey.create({
        data: {
          id: await ID.generateId('fineGrainedKey'),
          status: 'active',
          instanceOid: d.instance.oid,
          accessTagOid: d.accessTag.oid,
          secret: secretKey.toString(),
          secretRedacted: UnifiedApiKey.redact(secretKey),
          secretLength: secretKey.toString().length,
          expiresAt: d.input.expiresAt
        },
        include: includeFineGrainedKey
      });

      return {
        fineGrainedKey,
        secret: fineGrainedKey.secret
      };
    });
  }

  async rotateFineGrainedKey(d: {
    fineGrainedKey: FineGrainedKey;
    context: Context;
    input: Record<string, never>;
  }) {
    await this.ensureFineGrainedKeyActive(d.fineGrainedKey);

    return await withTransaction(async db => {
      let secretKey = UnifiedApiKey.create({
        type: 'fine_grained_token',
        config: { url: getConfig().urls.apiUrl, instance: 'v2-us1' }
      });

      let fineGrainedKey = await db.fineGrainedKey.update({
        where: { oid: d.fineGrainedKey.oid },
        data: {
          secret: secretKey.toString(),
          secretRedacted: UnifiedApiKey.redact(secretKey),
          secretLength: secretKey.toString().length
        },
        include: includeFineGrainedKey
      });

      return {
        fineGrainedKey,
        secret: fineGrainedKey.secret
      };
    });
  }

  async revokeFineGrainedKey(d: { fineGrainedKey: FineGrainedKey; context: Context }) {
    await this.ensureFineGrainedKeyActive(d.fineGrainedKey);

    return await db.fineGrainedKey.update({
      where: { oid: d.fineGrainedKey.oid },
      data: {
        status: 'deleted',
        deletedAt: new Date()
      },
      include: includeFineGrainedKey
    });
  }

  async revealFineGrainedKey(d: { fineGrainedKey: FineGrainedKey; context: Context }) {
    await this.ensureFineGrainedKeyActive(d.fineGrainedKey);
    return d.fineGrainedKey.secret;
  }

  async getFineGrainedKeyById(d: { fineGrainedKeyId: string; instance: Instance }) {
    let fineGrainedKey = await db.fineGrainedKey.findFirst({
      where: {
        id: d.fineGrainedKeyId,
        instanceOid: d.instance.oid
      },
      include: includeFineGrainedKey
    });
    if (!fineGrainedKey)
      throw new ServiceError(notFoundError('fine_grained_key', d.fineGrainedKeyId));

    return fineGrainedKey;
  }

  async listFineGrainedKeysByInstance(d: { instance: Instance }) {
    return await db.fineGrainedKey.findMany({
      where: {
        instanceOid: d.instance.oid,
        status: 'active'
      },
      include: includeFineGrainedKey
    });
  }
}

export let fineGrainedKeyService = Service.create(
  'fineGrainedKeyService',
  () => new FineGrainedKeyService()
).build();
