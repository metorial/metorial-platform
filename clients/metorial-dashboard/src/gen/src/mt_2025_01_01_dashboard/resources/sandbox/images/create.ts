import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type SandboxImagesCreateOutput = {
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

export let mapSandboxImagesCreateOutput =
  /* @__PURE__ */ mapObject<SandboxImagesCreateOutput>(
    ['latest_version_id', 'created_at', 'updated_at', 'deleted_at'],
    1
  );

export type SandboxImagesCreateBody = { name?: string | undefined };

export let mapSandboxImagesCreateBody =
  /* @__PURE__ */ createMapper<SandboxImagesCreateBody>(0);
