import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxImagesUpdateOutput = {
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

export let mapDashboardInstanceSandboxImagesUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxImagesUpdateOutput>(
    ['latest_version_id', 'created_at', 'updated_at', 'deleted_at'],
    1
  );

export type DashboardInstanceSandboxImagesUpdateBody = {
  name?: string | null | undefined;
};

export let mapDashboardInstanceSandboxImagesUpdateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxImagesUpdateBody>(0);
