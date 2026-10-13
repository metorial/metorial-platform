import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSandboxImagesVersionsGetOutput = {
  object: 'sandbox.image.version';
  id: string;
  imageId: string;
  status: 'pending' | 'active' | 'deleted';
  regions: string[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSandboxImagesVersionsGetOutput =
  mtMap.object<ManagementInstanceSandboxImagesVersionsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    imageId: mtMap.objectField('image_id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    regions: mtMap.objectField('regions', mtMap.array(mtMap.passthrough())),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

