import { Service } from '@lowerdeck/service';
import type { Instance } from '@metorial/db';
import { getTenantForSubspace } from '../subspace';
import { subspace } from '../subspace';

class SubspaceBrandService {
  async upsertBrand(d: {
    instance: Instance;
    input: {
      name: string;
      image: PrismaJson.EntityImage | null;
    };
  }) {
    let { tenant, environmentId } = await getTenantForSubspace(d.instance);

    return await subspace.brand.upsert({
      name: d.input.name,
      image: d.input.image,
      for: {
        type: 'tenant',
        tenantId: tenant.id,
        environmentId
      }
    });
  }
}

export let subspaceBrandService = Service.create(
  'subspaceBrandService',
  () => new SubspaceBrandService()
).build();

export type SubspaceBrand = Awaited<ReturnType<typeof subspace.brand.get>>;
