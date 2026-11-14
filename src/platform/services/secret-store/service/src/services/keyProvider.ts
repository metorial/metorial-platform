import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import { checkEdition } from '@metorial/editions';
import type { KeyProvider, Tenant } from '../../prisma/generated/client';
import { getKeyProviderAdapter } from '../adapters';
import { normalizeAdapterError } from '../adapters/_lib/errors';
import { db } from '../db';
import {
  defaultProviderType,
  env,
  isTenantProviderTypeEnabled,
  type ProviderType
} from '../env';
import { ID, snowflake } from '../id';
import { keyProviderErrorService } from './keyProviderError';

let defaultProviderSystemIdentifier = 'system:global:default';
let fingerprintIdentifierLength = 8;

let defaultProviderLock = createLock({
  name: 'neb/kprov/default/lock',
  redisUrl: env.service.REDIS_URL
});

let tenantProvidersUnavailable = () =>
  new ServiceError(
    badRequestError({ message: 'Tenant key providers are not available in this edition' })
  );

let resolveTenantProviderType = (type?: ProviderType | null) => {
  if (!checkEdition('cloud')) throw tenantProvidersUnavailable();

  let resolved = type ?? defaultProviderType;
  if (!isTenantProviderTypeEnabled(resolved)) {
    throw new ServiceError(
      badRequestError({ message: `Key provider type ${resolved} is not enabled` })
    );
  }

  return resolved;
};

let getSystemIdentifier = (d: {
  owner: KeyProvider['owner'];
  keyProviderId: string;
  tenant?: Tenant | null;
}) => {
  if (d.owner === 'system' && !d.tenant) return `system:global:${d.keyProviderId}`;
  if (d.owner === 'system' && d.tenant)
    return `system:tenant:${d.tenant.id}:${d.keyProviderId}`;
  if (d.owner === 'tenant' && d.tenant) return `tenant:${d.tenant.id}:${d.keyProviderId}`;
  throw new Error('Tenant is required for tenant-scoped key provider');
};

class KeyProviderServiceImpl {
  async ensureSystemDefaultProvider() {
    return await defaultProviderLock.usingLock(defaultProviderSystemIdentifier, async () => {
      let type = defaultProviderType;
      let adapter = getKeyProviderAdapter(type);
      let fingerprint = adapter.getSystemFingerprint();

      let candidates = await db.keyProvider.findMany({
        where: {
          owner: 'system',
          type,
          tenantOid: null,
          deletedAt: null,
          systemIdentifier: { startsWith: defaultProviderSystemIdentifier }
        },
        orderBy: { createdAt: 'desc' }
      });

      for (let candidate of candidates) {
        let storedFingerprint = (candidate.keyInfo as any)?.fingerprint;
        let matches = storedFingerprint
          ? storedFingerprint === fingerprint
          : await adapter.matchesLegacySystemKeyInfo(candidate.keyInfo);

        if (matches) return candidate;
      }

      try {
        let provider = await adapter.createSystemKeyProvider();
        let id = await ID.generateId('keyProvider');
        let fingerprintHash = (await Hash.sha256(fingerprint)).slice(
          0,
          fingerprintIdentifierLength
        );

        return await db.keyProvider.create({
          data: {
            oid: snowflake.nextId(),
            id,
            systemIdentifier: `${defaultProviderSystemIdentifier}:${type}:${fingerprintHash}`,
            name: provider.name,
            type,
            owner: 'system',
            status: 'active',
            isMetorialManaged: false,
            keyInfo: provider.keyInfo
          }
        });
      } catch (err) {
        throw normalizeAdapterError(err);
      }
    });
  }

  async importKeyProvider(d: {
    tenant: Tenant;
    type?: ProviderType | null;
    keyInput: Record<string, any>;
  }) {
    let type = resolveTenantProviderType(d.type);
    let adapter = getKeyProviderAdapter(type);

    try {
      let validated = await adapter.validateKeyProvider(d.keyInput);
      let id = await ID.generateId('keyProvider');

      let keyProvider = await db.keyProvider.create({
        data: {
          oid: snowflake.nextId(),
          id,
          tenantOid: d.tenant.oid,
          systemIdentifier: getSystemIdentifier({
            owner: 'tenant',
            tenant: d.tenant,
            keyProviderId: id
          }),
          name: validated.name,
          type,
          owner: 'tenant',
          status: 'active',
          isMetorialManaged: false,
          keyInfo: validated.keyInfo
        }
      });

      await this.setAsDefaultIfUsingGlobalDefault({ tenant: d.tenant, keyProvider });

      return keyProvider;
    } catch (err) {
      let normalized = normalizeAdapterError(err);
      throw new ServiceError(
        badRequestError({
          message: normalized.safeMessage
        })
      );
    }
  }

  async createManagedKeyProvider(d: {
    tenant: Tenant;
    input: {
      name: string;
    };
  }) {
    let type = resolveTenantProviderType();
    let adapter = getKeyProviderAdapter(type);

    try {
      let id = await ID.generateId('keyProvider');
      let systemIdentifier = getSystemIdentifier({
        owner: 'system',
        tenant: d.tenant,
        keyProviderId: id
      });

      let provider = await adapter.createTenantManagedKeyProvider({
        tenantId: d.tenant.id,
        tenantIdentifier: d.tenant.identifier,
        name: d.input.name,
        systemIdentifier
      });

      let keyProvider = await db.keyProvider.create({
        data: {
          oid: snowflake.nextId(),
          id,
          tenantOid: d.tenant.oid,
          systemIdentifier,
          name: provider.name,
          type,
          owner: 'system',
          status: 'active',
          isMetorialManaged: true,
          keyInfo: provider.keyInfo
        }
      });

      await this.setAsDefaultIfUsingGlobalDefault({ tenant: d.tenant, keyProvider });

      return keyProvider;
    } catch (err) {
      let normalized = normalizeAdapterError(err);
      throw new ServiceError(
        badRequestError({
          message: normalized.safeMessage
        })
      );
    }
  }

  async createManaged(d: Parameters<KeyProviderServiceImpl['createManagedKeyProvider']>[0]) {
    return await this.createManagedKeyProvider(d);
  }

  async getKeyProviderById(d: { tenant: Tenant; id: string }) {
    let keyProvider = await db.keyProvider.findFirst({
      where: {
        OR: [{ id: d.id }, { systemIdentifier: d.id }],
        deletedAt: null
      }
    });
    if (!keyProvider) throw new ServiceError(notFoundError('key.provider'));

    this.guardKeyProviderForTenant({ tenant: d.tenant ?? null, keyProvider });

    return keyProvider;
  }

  async listKeyProviders(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.keyProvider.findMany({
          ...opts,
          where: {
            deletedAt: null,
            OR: checkEdition('cloud')
              ? [
                  { owner: 'system', tenantOid: null },
                  { owner: 'system', tenantOid: d.tenant.oid },
                  { owner: 'tenant', tenantOid: d.tenant.oid }
                ]
              : [{ owner: 'system', tenantOid: null }]
          },
          orderBy: { createdAt: 'desc' }
        })
      )
    );
  }

  async resolveForTenant(d: { tenant: Tenant; keyProviderId?: string | null }) {
    if (d.keyProviderId) {
      return await this.getKeyProviderById({ tenant: d.tenant, id: d.keyProviderId });
    }

    if (checkEdition('cloud') && d.tenant.defaultKeyProviderOid) {
      let tenantDefault = await db.keyProvider.findUnique({
        where: { oid: d.tenant.defaultKeyProviderOid }
      });

      if (tenantDefault) {
        this.guardKeyProviderForTenant({ tenant: d.tenant, keyProvider: tenantDefault });
        if (tenantDefault.status === 'active') return tenantDefault;
      }
    }

    return await this.ensureSystemDefaultProvider();
  }

  async setDefaultKeyProvider(d: { tenant: Tenant; keyProviderId: string }) {
    let keyProvider = await this.getKeyProviderById({
      tenant: d.tenant,
      id: d.keyProviderId
    });

    return await db.tenant.update({
      where: { oid: d.tenant.oid },
      data: { defaultKeyProviderOid: keyProvider.oid },
      include: { defaultKeyProvider: true }
    });
  }

  async validateKeyProvider(d: { tenant: Tenant; keyProviderId: string }) {
    let keyProvider = await this.getKeyProviderById({ tenant: d.tenant, id: d.keyProviderId });
    this.guardTenantOwnedKeyProvider(keyProvider);
    let adapter = getKeyProviderAdapter(keyProvider.type);

    try {
      return await adapter.describeKeyProvider(keyProvider);
    } catch (err) {
      let normalized = normalizeAdapterError(err);
      await keyProviderErrorService.recordKeyProviderError({
        keyProvider,
        tenant: d.tenant,
        operation: 'validate_provider',
        code: normalized.code,
        message: normalized.safeMessage
      });
      throw new ServiceError(badRequestError({ message: 'Key provider is unavailable' }));
    }
  }

  async getSetupInfo(d: {
    tenant: Tenant;
    input: {
      type?: ProviderType | null;
      region?: string | null;
      keyId?: string | null;
    };
  }) {
    let type = resolveTenantProviderType(d.input.type);
    let adapter = getKeyProviderAdapter(type);

    return await adapter.getSetupInfo({
      tenantId: d.tenant.id,
      tenantIdentifier: d.tenant.identifier,
      region: d.input.region ?? undefined,
      keyId: d.input.keyId ?? undefined,
      roleArn: env.kms.KMS_EXTERNAL_KEY_ROLE_ARN
    });
  }

  guardKeyProviderForTenant(d: { tenant: Tenant; keyProvider: KeyProvider }) {
    if (d.keyProvider.owner === 'system' && d.keyProvider.tenantOid === null) return;

    if (!checkEdition('cloud') || !d.tenant || d.keyProvider.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('key.provider'));
    }
  }

  guardTenantOwnedKeyProvider(keyProvider: KeyProvider) {
    if (keyProvider.owner !== 'tenant' || this.isMetorialManaged(keyProvider)) {
      throw new ServiceError(
        badRequestError({ message: 'Key provider is managed by Metorial' })
      );
    }
  }

  isMetorialManaged(keyProvider: KeyProvider) {
    return (
      keyProvider.owner === 'system' ||
      keyProvider.isMetorialManaged ||
      (keyProvider.keyInfo as any)?.managedByNebula === true
    );
  }

  private async setAsDefaultIfUsingGlobalDefault(d: {
    tenant: Tenant;
    keyProvider: KeyProvider;
  }) {
    await db.tenant.updateMany({
      where: {
        oid: d.tenant.oid,
        defaultKeyProviderOid: null
      },
      data: {
        defaultKeyProviderOid: d.keyProvider.oid
      }
    });
  }
}

export let keyProviderService = Service.create(
  'keyProviderService',
  () => new KeyProviderServiceImpl()
).build();
