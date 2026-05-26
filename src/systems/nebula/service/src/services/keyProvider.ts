import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { KeyProvider, Tenant } from '../../prisma/generated/client';
import { getKeyProviderAdapter } from '../adapters';
import { normalizeAdapterError } from '../adapters/_lib/errors';
import { db } from '../db';
import { env } from '../env';
import { ID, snowflake } from '../id';
import { keyProviderErrorService } from './keyProviderError';

let defaultProviderSystemIdentifier = 'system:global:default';

let defaultProviderLock = createLock({
  name: 'neb/kprov/default/lock',
  redisUrl: env.service.REDIS_URL
});

let toProviderType = (type: KeyProvider['type'] | 'aws.kms') =>
  type === 'aws.kms' ? 'aws_kms' : type;

let getConfiguredProviderType = () => toProviderType(env.provider.DEFAULT_PROVIDER);

let getSystemIdentifier = (d: {
  owner: KeyProvider['owner'];
  keyProviderId: string;
  tenant?: Tenant | null;
}) => {
  if (d.owner === 'system' && !d.tenant) return `system:global:${d.keyProviderId}`;
  if (d.owner === 'system' && d.tenant) return `system:tenant:${d.tenant.id}:${d.keyProviderId}`;
  if (d.owner === 'tenant' && d.tenant) return `tenant:${d.tenant.id}:${d.keyProviderId}`;
  throw new Error('Tenant is required for tenant-scoped key provider');
};

class KeyProviderServiceImpl {
  async ensureSystemDefaultProvider() {
    return await defaultProviderLock.usingLock(defaultProviderSystemIdentifier, async () => {
      let existing = await db.keyProvider.findFirst({
        where: {
          owner: 'system',
          systemIdentifier: defaultProviderSystemIdentifier,
          tenantOid: null,
          deletedAt: null
        }
      });
      if (existing) return existing;

      let type = getConfiguredProviderType();
      let adapter = getKeyProviderAdapter(type);

      try {
        let provider = await adapter.createSystemKeyProvider();
        let id = await ID.generateId('keyProvider');

        return await db.keyProvider.create({
          data: {
            oid: snowflake.nextId(),
            id,
            systemIdentifier: defaultProviderSystemIdentifier,
            name: provider.name,
            type,
            owner: 'system',
            status: 'active',
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
    keyInput: Record<string, any>;
  }) {
    let type = getConfiguredProviderType();
    let adapter = getKeyProviderAdapter(type);

    try {
      let validated = await adapter.validateKeyProvider(d.keyInput);
      let id = await ID.generateId('keyProvider');

      return await db.keyProvider.create({
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
          keyInfo: validated.keyInfo
        }
      });
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
    let type = getConfiguredProviderType();
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

      return await db.keyProvider.create({
        data: {
          oid: snowflake.nextId(),
          id,
          tenantOid: d.tenant.oid,
          systemIdentifier,
          name: provider.name,
          type,
          owner: 'system',
          status: 'active',
          keyInfo: provider.keyInfo
        }
      });
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

  async getKeyProviderById(d: { tenant?: Tenant | null; id: string }) {
    let keyProvider = await db.keyProvider.findFirst({
      where: {
        OR: [
          { id: d.id },
          { systemIdentifier: d.id }
        ],
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
            OR: [
              { owner: 'system', tenantOid: null },
              { owner: 'system', tenantOid: d.tenant.oid },
              { owner: 'tenant', tenantOid: d.tenant.oid }
            ]
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

    if (d.tenant.defaultKeyProviderOid) {
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
      region?: string | null;
      keyId?: string | null;
    };
  }) {
    let type = getConfiguredProviderType();
    let adapter = getKeyProviderAdapter(type);

    return await adapter.getSetupInfo({
      tenantId: d.tenant.id,
      tenantIdentifier: d.tenant.identifier,
      region: d.input.region ?? undefined,
      keyId: d.input.keyId ?? undefined,
      roleArn: env.kms.KMS_EXTERNAL_KEY_ROLE_ARN
    });
  }

  guardKeyProviderForTenant(d: { tenant: Tenant | null; keyProvider: KeyProvider }) {
    if (d.keyProvider.owner === 'system' && d.keyProvider.tenantOid === null) return;

    if (!d.tenant || d.keyProvider.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('key.provider'));
    }
  }
}

export let keyProviderService = Service.create(
  'keyProviderService',
  () => new KeyProviderServiceImpl()
).build();
