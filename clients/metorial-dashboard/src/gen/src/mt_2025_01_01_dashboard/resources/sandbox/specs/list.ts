import { mtMap } from '@metorial/util-resource-mapper';

export type SandboxSpecsListOutput = {
  items: {
    object: 'sandbox.spec';
    id: string;
    identifier: string;
    memoryMib: number;
    vcpus: number;
    regions: string[];
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSandboxSpecsListOutput = mtMap.object<SandboxSpecsListOutput>({
  items: mtMap.objectField(
    'items',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        memoryMib: mtMap.objectField('memory_mib', mtMap.passthrough()),
        vcpus: mtMap.objectField('vcpus', mtMap.passthrough()),
        regions: mtMap.objectField('regions', mtMap.array(mtMap.passthrough())),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    )
  ),
  pagination: mtMap.objectField(
    'pagination',
    mtMap.object({
      hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
      hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
    })
  )
});

export type SandboxSpecsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapSandboxSpecsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

