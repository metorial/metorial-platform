import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxSpecType } from '../../types';

export let v1SandboxSpecPresenter = Presenter.create(sandboxSpecType)
  .presenter(async ({ spec, available }) => ({
    object: 'sandbox.spec' as const,

    id: spec.id,
    identifier: spec.identifier,
    memory_gib: spec.memoryMiB / 1024,
    cpus: spec.vcpus,
    available,
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
        examples: ['m3072-c3000']
      }),
      memory_gib: v.number({
        description: 'The memory of machines using this spec, in GiB',
        examples: [3]
      }),
      cpus: v.number({
        description: 'The number of CPUs of machines using this spec',
        examples: [3]
      }),
      available: v.boolean({
        description: "Whether your organization's plan allows creating machines with this spec"
      }),
      regions: v.array(v.string(), {
        description: 'The identifiers of the regions this spec is available in'
      }),
      created_at: v.date({ description: "The spec's creation date" })
    })
  )
  .build();
