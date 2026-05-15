import { randomBytes } from 'crypto';
import type {
  Environment,
  File,
  FileLink,
  FilePurpose,
  PrismaClient,
  Tenant
} from '@metorial-cargo/db';
import { defineFactory } from '@lowerdeck/testing-tools';
import { getId } from '@metorial-cargo/db';

let randomSuffix = () => randomBytes(4).toString('hex');

export let fixtures = (db: PrismaClient) => {
  let tenant = {
    default: async (overrides: Partial<Tenant> = {}) => {
      let ids = getId('tenant');
      let identifier = overrides.identifier ?? `tenant-${randomSuffix()}`;

      let factory = defineFactory<Tenant>(
        {
          oid: ids.oid,
          id: overrides.id ?? ids.id,
          identifier,
          name: overrides.name ?? `Tenant ${identifier}`,
          createdAt: overrides.createdAt ?? new Date()
        } as Tenant,
        {
          persist: value => db.tenant.create({ data: value })
        }
      );

      return factory.create(overrides);
    }
  };

  let environment = {
    default: async (tenantValue: Tenant, overrides: Partial<Environment> = {}) => {
      let ids = getId('environment');
      let identifier = overrides.identifier ?? `env-${randomSuffix()}`;

      let factory = defineFactory<Environment>(
        {
          oid: ids.oid,
          id: overrides.id ?? ids.id,
          tenantOid: tenantValue.oid,
          identifier,
          name: overrides.name ?? `Environment ${identifier}`,
          type: overrides.type ?? 'development',
          createdAt: overrides.createdAt ?? new Date()
        } as Environment,
        {
          persist: value => db.environment.create({ data: value })
        }
      );

      return factory.create(overrides);
    }
  };

  let filePurpose = {
    default: async (overrides: Partial<FilePurpose> = {}) => {
      let ids = getId('filePurpose');
      let slug = overrides.slug ?? `purpose-${randomSuffix()}`;

      let factory = defineFactory<FilePurpose>(
        {
          oid: ids.oid,
          id: overrides.id ?? ids.id,
          slug,
          name: overrides.name ?? `Purpose ${slug}`,
          ownerType: overrides.ownerType ?? 'organization',
          canHaveLinks: overrides.canHaveLinks ?? true,
          createdAt: overrides.createdAt ?? new Date()
        } as FilePurpose,
        {
          persist: value => db.filePurpose.create({ data: value })
        }
      );

      return factory.create(overrides);
    }
  };

  let file = {
    default: async (
      tenantValue: Tenant,
      environmentValue: Environment,
      purposeValue: FilePurpose,
      overrides: Partial<File> = {}
    ) => {
      let ids = getId('file');
      let storeId = overrides.storeId ?? `store-${randomSuffix()}`;

      let factory = defineFactory<File>(
        {
          oid: ids.oid,
          id: overrides.id ?? ids.id,
          tenantOid: tenantValue.oid,
          environmentOid: environmentValue.oid,
          purposeOid: purposeValue.oid,
          status: overrides.status ?? 'active',
          storeId,
          fileName: overrides.fileName ?? 'example.png',
          fileSize: overrides.fileSize ?? 128,
          fileType: overrides.fileType ?? 'image/png',
          title: overrides.title ?? null,
          createdAt: overrides.createdAt ?? new Date(),
          updatedAt: overrides.updatedAt ?? new Date()
        } as File,
        {
          persist: value => db.file.create({ data: value })
        }
      );

      return factory.create(overrides);
    }
  };

  let fileLink = {
    default: async (fileValue: File, overrides: Partial<FileLink> = {}) => {
      let ids = getId('fileLink');

      let factory = defineFactory<FileLink>(
        {
          oid: ids.oid,
          id: overrides.id ?? ids.id,
          tenantOid: fileValue.tenantOid,
          environmentOid: fileValue.environmentOid,
          fileOid: fileValue.oid,
          key: overrides.key ?? `key_${randomSuffix()}`,
          createdAt: overrides.createdAt ?? new Date(),
          expiresAt: overrides.expiresAt ?? null
        } as FileLink,
        {
          persist: value => db.fileLink.create({ data: value })
        }
      );

      return factory.create(overrides);
    }
  };

  return {
    tenant,
    environment,
    filePurpose,
    file,
    fileLink
  };
};
