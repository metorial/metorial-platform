import { badRequestError, forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createLocallyCachedFunction } from '@metorial/cache';
import { db, type Organization, type SandboxRegion, type SandboxSpec } from '@metorial/db';
import { flagService, type Flags } from '@metorial/module-flags';

let SPEC_CACHE_TTL_SECONDS = 60;

export type SandboxSpecSelector = {
  specId?: string;
  specIdentifier?: string;
  memoryGib?: number;
  cpus?: number;
};

export let sandboxSpecIdentifier = (d: { memoryGib: number; cpus: number }) =>
  `m${Math.round(d.memoryGib * 1024)}-c${Math.round(d.cpus * 1000)}`;

export let isSandboxSpecAvailable = (d: {
  spec: Pick<SandboxSpec, 'memoryMiB' | 'vcpus'>;
  flags: Pick<Flags, 'sandbox-max-memory-gib' | 'sandbox-max-vcpus'>;
}) =>
  d.spec.memoryMiB / 1024 <= d.flags['sandbox-max-memory-gib'] &&
  d.spec.vcpus <= d.flags['sandbox-max-vcpus'];

export let sandboxSpecInclude = {
  regions: { where: { status: 'active' }, include: { region: true } }
} as const;

let getSpecCached = createLocallyCachedFunction({
  getHash: (i: { specId: string }) => i.specId,
  ttlSeconds: SPEC_CACHE_TTL_SECONDS,
  provider: async i => {
    let spec = await db.sandboxSpec.findFirst({
      where: { id: i.specId },
      include: sandboxSpecInclude
    });
    if (!spec) throw new ServiceError(notFoundError('sandbox_spec', i.specId));

    return spec;
  }
});

class SandboxSpecServiceImpl {
  async list() {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sandboxSpec.findMany({
            ...opts,
            where: { status: 'active' },
            include: sandboxSpecInclude
          })
      )
    );
  }

  async get(d: { specId: string }) {
    return await getSpecCached({ specId: d.specId });
  }

  async getByIdentifier(d: { identifier: string }) {
    let spec = await db.sandboxSpec.findFirst({
      where: { identifier: d.identifier, status: 'active' },
      include: sandboxSpecInclude
    });
    if (!spec) {
      throw new ServiceError(
        badRequestError({ message: `There is no machine spec ${d.identifier}` })
      );
    }

    return spec;
  }

  async select(d: { selector: SandboxSpecSelector }) {
    let { specId, specIdentifier, memoryGib, cpus } = d.selector;
    let hasSize = memoryGib !== undefined || cpus !== undefined;

    if ([specId !== undefined, specIdentifier !== undefined, hasSize].filter(Boolean).length != 1) {
      throw new ServiceError(
        badRequestError({
          message: 'Provide exactly one of spec_id, spec_identifier, or memory_gib with cpus'
        })
      );
    }

    if (specId !== undefined) return await this.get({ specId });
    if (specIdentifier !== undefined) return await this.getByIdentifier({ identifier: specIdentifier });

    if (memoryGib === undefined || cpus === undefined) {
      throw new ServiceError(
        badRequestError({ message: 'memory_gib and cpus must be provided together' })
      );
    }

    return await this.getByIdentifier({ identifier: sandboxSpecIdentifier({ memoryGib, cpus }) });
  }

  async resolve(d: {
    selector: SandboxSpecSelector;
    region: SandboxRegion;
    organization: Organization;
  }) {
    let spec = await this.select({ selector: d.selector });
    if (spec.status != 'active') {
      throw new ServiceError(
        badRequestError({ message: `Spec ${spec.id} is no longer available` })
      );
    }

    let flags = await flagService.getFlags({ organization: d.organization });
    if (!isSandboxSpecAvailable({ spec, flags })) {
      throw new ServiceError(
        forbiddenError({
          message: `Spec ${spec.identifier} is not available on your plan. Upgrade to use machines of this size.`
        })
      );
    }

    let regional = spec.regions.find(regional => regional.regionOid == d.region.oid);
    if (!regional) {
      throw new ServiceError(
        badRequestError({
          message: `Spec ${spec.id} is not available in region ${d.region.identifier}`
        })
      );
    }

    return { spec, regional };
  }
}

export let sandboxSpecService = Service.create(
  'sandboxSpecService',
  () => new SandboxSpecServiceImpl()
).build();
