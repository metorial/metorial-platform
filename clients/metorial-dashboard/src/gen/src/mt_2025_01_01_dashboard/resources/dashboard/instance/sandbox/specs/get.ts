import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSandboxSpecsGetOutput = {
  object: 'sandbox.spec';
  id: string;
  identifier: string;
  memoryMib: number;
  vcpus: number;
  regions: string[];
  createdAt: Date;
};

export let mapDashboardInstanceSandboxSpecsGetOutput =
  mtMap.object<DashboardInstanceSandboxSpecsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
    memoryMib: mtMap.objectField('memory_mib', mtMap.passthrough()),
    vcpus: mtMap.objectField('vcpus', mtMap.passthrough()),
    regions: mtMap.objectField('regions', mtMap.array(mtMap.passthrough())),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

