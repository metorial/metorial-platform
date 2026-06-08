import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { addAfterTransactionHook, db, getId } from '@metorial-cargo/db';
import { storeTemplateSyncSingleQueue } from '@metorial-cargo/module-store';

let include = {
  tenant: true
};

class EnvironmentServiceImpl {
  async upsertEnvironment(d: {
    tenant: { oid: bigint };
    input: {
      identifier: string;
      name: string;
      type: 'development' | 'production';
    };
  }) {
    let existing = await db.environment.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        identifier: d.input.identifier
      },
      include
    });

    if (existing) {
      return await db.environment.update({
        where: {
          id: existing.id
        },
        data: {
          name: d.input.name,
          type: d.input.type
        },
        include
      });
    }

    let { oid, id } = getId('environment');

    let environment = await db.environment.upsert({
      where: {
        tenantOid_identifier: {
          tenantOid: d.tenant.oid,
          identifier: d.input.identifier
        }
      },
      update: {
        name: d.input.name,
        type: d.input.type
      },
      create: {
        oid,
        id,
        tenantOid: d.tenant.oid,
        identifier: d.input.identifier,
        name: d.input.name,
        type: d.input.type
      },
      include
    });

    await addAfterTransactionHook(async () => {
      let storeTemplates = await db.storeTemplate.findMany({
        where: {
          type: 'standalone',
          environmentOid: null,
          OR: [
            {
              tenantOid: null
            },
            {
              tenantOid: d.tenant.oid
            }
          ]
        },
        select: {
          id: true
        }
      });

      if (storeTemplates.length === 0) return;

      await storeTemplateSyncSingleQueue.addMany(
        storeTemplates.map(storeTemplate => ({
          storeTemplateId: storeTemplate.id,
          tenantId: environment.tenant.id,
          environmentId: environment.id,
          forceFullReconcile: true
        }))
      );
    });

    return environment;
  }

  async getEnvironmentById(d: { tenant: { oid: bigint }; id: string }) {
    let environment = await db.environment.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        OR: [{ id: d.id }, { identifier: d.id }]
      },
      include
    });

    if (!environment) throw new ServiceError(notFoundError('environment', d.id));

    return environment;
  }

  async listEnvironments(d: { tenant: { oid: bigint } }) {
    return await db.environment.findMany({
      where: {
        tenantOid: d.tenant.oid
      },
      orderBy: {
        createdAt: 'asc'
      },
      include
    });
  }
}

export let environmentService = Service.create(
  'cargoEnvironmentService',
  () => new EnvironmentServiceImpl()
).build();
