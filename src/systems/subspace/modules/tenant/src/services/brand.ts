import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, getId, Prisma, type Tenant } from '@metorial-subspace/db';

let include = {};

let defaultBrand = db.brand.upsert({
  where: { identifier: 'default' },
  update: { name: 'Default' },
  create: {
    ...getId('brand'),
    name: 'Metorial',
    identifier: 'default',
    image: {
      type: 'url',
      url: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg'
    }
  },
  include
});

class brandServiceImpl {
  async upsertBrand(d: {
    input: {
      name: string;
      image: PrismaJson.EntityImage | null;

      for:
        | {
            type: 'identifier';
            identifier: string;
          }
        | {
            type: 'tenant';
            tenant: Tenant;
          };
    };
  }) {
    let identifier =
      d.input.for.type === 'identifier' ? d.input.for.identifier : d.input.for.tenant.id;

    return await db.brand.upsert({
      where: { identifier },
      update: {
        name: d.input.name,
        image: d.input.image ?? Prisma.DbNull
      },
      create: {
        ...getId('brand'),
        name: d.input.name,
        identifier,
        tenantOid: d.input.for.type === 'tenant' ? d.input.for.tenant.oid : undefined,
        image: d.input.image ?? Prisma.DbNull
      },
      include
    });
  }

  async getBrandById(d: { id: string }) {
    let Brand = await db.brand.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] },
      include
    });
    if (!Brand) throw new ServiceError(notFoundError('Brand'));
    return Brand;
  }

  async getBrandForTenant(d: { tenantId: string }) {
    let tenant = await db.tenant.findUnique({
      where: { id: d.tenantId },
      include: { brand: true }
    });

    if (tenant?.brand) return tenant.brand;

    return await defaultBrand;
  }
}

export let brandService = Service.create('brandService', () => new brandServiceImpl()).build();
