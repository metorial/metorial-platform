import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxSpecType } from '../../types';

export let v1SandboxSpecPresenter = Presenter.create(sandboxSpecType)
  .presenter(async ({ spec }) => ({
    object: 'sandbox.spec' as const,

    id: spec.id,
    identifier: spec.identifier,
    memory_mib: spec.memoryMiB,
    vcpus: spec.vcpus,
    regions: spec.regions.map(regional => regional.region.identifier),
    created_at: spec.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.spec', {
        description: "String representing the object's type"
      }),

      id: v.string({
        description: "The spec's unique identifier",
        examples: ['sbs_7hNkPqRsTuVwXyZa']
      }),
      identifier: v.string({
        description: "The spec's human-readable identifier",
        examples: ['small']
      }),
      memory_mib: v.number({ description: 'The memory of machines using this spec, in MiB' }),
      vcpus: v.number({
        description: 'The number of virtual CPUs of machines using this spec'
      }),
      regions: v.array(v.string(), {
        description: 'The identifiers of the regions this spec is available in'
      }),
      created_at: v.date({ description: "The spec's creation date" })
    })
  )
  .build();
