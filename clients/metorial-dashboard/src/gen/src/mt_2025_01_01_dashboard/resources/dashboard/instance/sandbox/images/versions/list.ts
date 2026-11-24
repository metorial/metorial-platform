import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxImagesVersionsListOutput = {
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

export let mapDashboardInstanceSandboxImagesVersionsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxImagesVersionsListOutput>(
    [
      7,
      [
        1,
        ['image_id', 'version_number', 'build_id', 'created_at', 'updated_at']
      ]
    ],
    1
  );

export type DashboardInstanceSandboxImagesVersionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceSandboxImagesVersionsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxImagesVersionsListQuery>(
    0
  );
