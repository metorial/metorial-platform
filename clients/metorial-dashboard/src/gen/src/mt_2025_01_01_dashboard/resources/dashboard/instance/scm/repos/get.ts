import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceScmReposGetOutput = {
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

export let mapDashboardInstanceScmReposGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceScmReposGetOutput>(
    ['is_private', 'default_branch', 'created_at'],
    1
  );
