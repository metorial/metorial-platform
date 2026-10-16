import { createMapper } from '@metorial/util-resource-mapper/compact';

export type SandboxImagesVersionsListOutput = {
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

export let mapSandboxImagesVersionsListOutput =
  /* @__PURE__ */ createMapper<SandboxImagesVersionsListOutput>(
    [
      7,
      [
        1,
        ['image_id', 'version_number', 'build_id', 'created_at', 'updated_at']
      ]
    ],
    1
  );

export type SandboxImagesVersionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapSandboxImagesVersionsListQuery =
  /* @__PURE__ */ createMapper<SandboxImagesVersionsListQuery>(0);
