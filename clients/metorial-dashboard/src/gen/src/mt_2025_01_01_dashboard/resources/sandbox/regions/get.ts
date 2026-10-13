import { mtMap } from '@metorial/util-resource-mapper';

export type SandboxRegionsGetOutput = {
  object: 'sandbox.region';
  id: string;
  name: string;
  area: { id: string; name: string };
};

export let mapSandboxRegionsGetOutput = mtMap.object<SandboxRegionsGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  area: mtMap.objectField(
    'area',
    mtMap.object({
      id: mtMap.objectField('id', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough())
    })
  )
});

