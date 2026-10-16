import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxImagesCreateOutput = {
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
};

export let mapDashboardInstanceSandboxImagesCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxImagesCreateOutput>(
    [
      'latest_version_id',
      'latest_version_number',
      'created_at',
      'updated_at',
      'deleted_at'
    ],
    1
  );

export type DashboardInstanceSandboxImagesCreateBody = {
  name?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapDashboardInstanceSandboxImagesCreateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxImagesCreateBody>(0);
