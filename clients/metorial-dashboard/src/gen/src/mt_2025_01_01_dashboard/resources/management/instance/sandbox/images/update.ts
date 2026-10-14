import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxImagesUpdateOutput>(
    ['latest_version_id', 'created_at', 'updated_at', 'deleted_at'],
    1
  );

export type ManagementInstanceSandboxImagesUpdateBody = {
  name?: string | null | undefined;
};

export let mapManagementInstanceSandboxImagesUpdateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxImagesUpdateBody>(0);
