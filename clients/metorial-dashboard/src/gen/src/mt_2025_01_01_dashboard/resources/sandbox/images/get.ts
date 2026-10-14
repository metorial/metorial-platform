import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SandboxImagesGetOutput = {
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

export let mapSandboxImagesGetOutput =
  /* @__PURE__ */ mapObject<SandboxImagesGetOutput>(
    ['latest_version_id', 'created_at', 'updated_at', 'deleted_at'],
    1
  );
