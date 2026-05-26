import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  KeyProvider,
  KeyProviderErrorOperation,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { ID, snowflake } from '../id';

let startOfUtcDay = (date = new Date()) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

let safeSample = (message: string) => message.slice(0, 500);

class KeyProviderErrorServiceImpl {
  async recordKeyProviderError(d: {
    keyProvider: KeyProvider;
    tenant?: Tenant | null;
    operation: KeyProviderErrorOperation;
    code: string;
    message: string;
  }) {
    let day = startOfUtcDay();
    let messageHash = await Hash.sha256(d.message);

    return await db.keyError.upsert({
      where: {
        keyProviderOid_day_operation_code_messageHash: {
          keyProviderOid: d.keyProvider.oid,
          day,
          operation: d.operation,
          code: d.code,
          messageHash
        }
      },
      update: {
        count: { increment: 1 },
        lastSeenAt: new Date(),
        sampleMessage: safeSample(d.message)
      },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('keyError'),
        keyProviderOid: d.keyProvider.oid,
        tenantOid: d.tenant?.oid,
        day,
        operation: d.operation,
        code: d.code,
        messageHash,
        sampleMessage: safeSample(d.message)
      }
    });
  }

  async listKeyProviderErrors(d: { keyProvider: KeyProvider; tenant?: Tenant | null }) {
    if (d.keyProvider.owner !== 'tenant') {
      throw new ServiceError(
        badRequestError({ message: 'Key provider errors are unavailable' })
      );
    }

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.keyError.findMany({
          ...opts,
          where: {
            keyProviderOid: d.keyProvider.oid,
            tenantOid: d.keyProvider.owner === 'tenant' ? d.tenant?.oid : undefined
          },
          orderBy: { lastSeenAt: 'desc' }
        })
      )
    );
  }
}

export let keyProviderErrorService = Service.create(
  'keyProviderErrorService',
  () => new KeyProviderErrorServiceImpl()
).build();
