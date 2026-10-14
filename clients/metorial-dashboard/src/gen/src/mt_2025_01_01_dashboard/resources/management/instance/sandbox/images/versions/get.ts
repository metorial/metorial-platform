import { mapObject } from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxImagesVersionsGetOutput>(
    ['image_id', 'created_at', 'updated_at'],
    1
  );
