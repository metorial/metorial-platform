import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ScmReposGetOutput = {
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

export let mapScmReposGetOutput = /* @__PURE__ */ mapObject<ScmReposGetOutput>(
  ['is_private', 'default_branch', 'created_at'],
  1
);
