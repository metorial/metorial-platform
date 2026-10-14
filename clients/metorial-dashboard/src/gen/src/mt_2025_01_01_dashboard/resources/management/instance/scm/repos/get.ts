import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceScmReposGetOutput = {
  object: 'scm.repository';
  id: string;
  provider: {
    object: 'scm.provider';
    type: 'github' | 'gitlab' | 'bitbucket';
    id: string;
    name: string;
    owner: string;
  };
  url: string;
  isPrivate: boolean;
  defaultBranch: string;
  createdAt: Date;
};

export let mapManagementInstanceScmReposGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceScmReposGetOutput>(
    ['is_private', 'default_branch', 'created_at'],
    1
  );
