import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxImagesVersionsListOutput = {
  items: {
    object: 'sandbox.image.version';
    id: string;
    imageId: string;
    versionNumber: number | null;
    buildId: string | null;
    status: 'pending' | 'active' | 'deleted';
    regions: string[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSandboxImagesVersionsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxImagesVersionsListOutput>(
    [
      7,
      [
        1,
        ['image_id', 'version_number', 'build_id', 'created_at', 'updated_at']
      ]
    ],
    1
  );

export type ManagementInstanceSandboxImagesVersionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceSandboxImagesVersionsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxImagesVersionsListQuery>(
    0
  );
