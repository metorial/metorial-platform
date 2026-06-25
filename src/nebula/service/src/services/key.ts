import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import type { Key, KeyProvider, Tenant } from '../../prisma/generated/client';
import { getKeyProviderAdapter } from '../adapters';
import { normalizeAdapterError } from '../adapters/_lib/errors';
import { db } from '../db';
import { env } from '../env';
import { ID, snowflake } from '../id';
import { dataKeyCache, getDataKeyCacheKey } from '../lib/dataKeyCache';
import { keyProviderErrorService } from './keyProviderError';

let currentKeyLock = createLock({
  name: 'neb/key/current/lock',
  redisUrl: env.service.REDIS_URL
});

let maxReuseSeconds = 24 * 60 * 60;

let getEffectiveReuseSeconds = (d: { tenant: Tenant; keyProvider: KeyProvider }) =>
  Math.max(
    1,
    Math.min(
      maxReuseSeconds,
      d.tenant.keyReuseTimeSeconds ?? maxReuseSeconds,
      d.keyProvider.keyReuseTimeSeconds ?? maxReuseSeconds
    )
  );

class KeyServiceImpl {
  async getCurrentKeyForEncryption(d: { tenant: Tenant; keyProvider: KeyProvider }) {
    let existing = await this.findCurrentKey(d);
    if (existing) return existing;

    return await currentKeyLock.usingLock(`${d.tenant.id}:${d.keyProvider.id}`, async () => {
      let lockedExisting = await this.findCurrentKey(d);
      if (lockedExisting) return lockedExisting;

      let adapter = getKeyProviderAdapter(d.keyProvider.type);
      let currentUntil = new Date(Date.now() + getEffectiveReuseSeconds(d) * 1000);
      let keyId = await ID.generateId('key');

      try {
        let dataKey = await adapter.generateDataKey(d.keyProvider, {
          tenantId: d.tenant.id,
          tenantOid: d.tenant.oid,
          keyProviderId: d.keyProvider.id,
          keyProviderOid: d.keyProvider.oid,
          keyId
        });

        let key = await db.key.create({
          data: {
            oid: snowflake.nextId(),
            id: keyId,
            tenantOid: d.tenant.oid,
            keyProviderOid: d.keyProvider.oid,
            encryptedDataKey: new Uint8Array(dataKey.encryptedDataKey),
            keyInfo: dataKey.keyInfo,
            currentUntil
          }
        });

        dataKeyCache.set(
          getDataKeyCacheKey({
            keyId: key.id,
            encryptedDataKey: dataKey.encryptedDataKey,
            keyInfo: dataKey.keyInfo
          }),
          dataKey.plaintextDataKey
        );

        return key;
      } catch (err) {
        let normalized = normalizeAdapterError(err);
        await keyProviderErrorService.recordKeyProviderError({
          keyProvider: d.keyProvider,
          tenant: d.tenant,
          operation: 'generate_data_key',
          code: normalized.code,
          message: normalized.safeMessage
        });

        throw new ServiceError(badRequestError({ message: 'Key provider is unavailable' }));
      }
    });
  }

  async getPlaintextDataKey(d: { tenant: Tenant; key: Key & { keyProvider: KeyProvider } }) {
    if (d.key.tenantOid !== d.tenant.oid) {
      throw new ServiceError(badRequestError({ message: 'Unable to use secret' }));
    }

    let cacheKey = getDataKeyCacheKey({
      keyId: d.key.id,
      encryptedDataKey: d.key.encryptedDataKey,
      keyInfo: d.key.keyInfo
    });
    let cached = dataKeyCache.get(cacheKey);
    if (cached) return cached;

    let adapter = getKeyProviderAdapter(d.key.keyProvider.type);

    try {
      let plaintext = await adapter.decryptDataKey(
        d.key.keyProvider,
        d.key.encryptedDataKey,
        d.key.keyInfo,
        {
          tenantId: d.tenant.id,
          tenantOid: d.tenant.oid,
          keyProviderId: d.key.keyProvider.id,
          keyProviderOid: d.key.keyProvider.oid,
          keyId: d.key.id
        }
      );

      dataKeyCache.set(cacheKey, plaintext);
      return plaintext;
    } catch (err) {
      let normalized = normalizeAdapterError(err);
      await keyProviderErrorService.recordKeyProviderError({
        keyProvider: d.key.keyProvider,
        tenant: d.tenant,
        operation: 'decrypt_data_key',
        code: normalized.code,
        message: normalized.safeMessage
      });

      throw new ServiceError(badRequestError({ message: 'Unable to use secret' }));
    }
  }

  private async findCurrentKey(d: { tenant: Tenant; keyProvider: KeyProvider }) {
    return await db.key.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        keyProviderOid: d.keyProvider.oid,
        currentUntil: { gt: new Date() },
        retiredAt: null
      },
      orderBy: { currentUntil: 'desc' }
    });
  }
}

export let keyService = Service.create('keyService', () => new KeyServiceImpl()).build();
