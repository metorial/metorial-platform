import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSandboxImagesUpdateOutput = {
  object: 'sandbox.image';
  id: string;
  owner: 'own' | 'global';
  status: 'pending' | 'active' | 'deleted';
  name: string | null;
  identifier: string | null;
  regions: string[];
  latestVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export let mapManagementInstanceSandboxImagesUpdateOutput =
  mtMap.object<ManagementInstanceSandboxImagesUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    owner: mtMap.objectField('owner', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
    regions: mtMap.objectField('regions', mtMap.array(mtMap.passthrough())),
    latestVersionId: mtMap.objectField(
      'latest_version_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    deletedAt: mtMap.objectField('deleted_at', mtMap.date())
  });

export type ManagementInstanceSandboxImagesUpdateBody = {
  name?: string | null | undefined;
};

export let mapManagementInstanceSandboxImagesUpdateBody =
  mtMap.object<ManagementInstanceSandboxImagesUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough())
  });

