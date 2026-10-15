import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxImagesListOutput = {
  items: {
    object: 'sandbox.image';
    metadata: Record<string, any>;
    id: string;
    owner: 'own' | 'global';
    status: 'pending' | 'active' | 'deleted';
    name: string | null;
    identifier: string | null;
    regions: string[];
    latestVersionId: string | null;
    latestVersionNumber: number | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSandboxImagesListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxImagesListOutput>(
    [
      7,
      [
        1,
        [
          'latest_version_id',
          'latest_version_number',
          'created_at',
          'updated_at',
          'deleted_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSandboxImagesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  owner?: 'own' | 'global' | ('own' | 'global')[] | undefined;
  status?:
    | 'pending'
    | 'active'
    | 'deleted'
    | ('pending' | 'active' | 'deleted')[]
    | undefined;
  search?: string | undefined;
};

export let mapDashboardInstanceSandboxImagesListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxImagesListQuery>(0);
