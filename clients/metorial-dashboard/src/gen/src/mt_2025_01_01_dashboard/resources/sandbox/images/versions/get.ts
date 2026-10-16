import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SandboxImagesVersionsGetOutput = {
  object: 'sandbox.image.version';
  id: string;
  imageId: string;
  versionNumber: number | null;
  buildId: string | null;
  status: 'pending' | 'active' | 'deleted';
  regions: string[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapSandboxImagesVersionsGetOutput =
  /* @__PURE__ */ mapObject<SandboxImagesVersionsGetOutput>(
    ['image_id', 'version_number', 'build_id', 'created_at', 'updated_at'],
    1
  );
