import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ScmReposListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapScmReposListOutput =
  /* @__PURE__ */ createMapper<ScmReposListOutput>(
    [7, [1, ['is_private', 'default_branch', 'created_at']]],
    1
  );

export type ScmReposListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapScmReposListQuery =
  /* @__PURE__ */ createMapper<ScmReposListQuery>([
    3,
    [[0, [1, ['provider_id', ['created_at', 1, 5], ['updated_at', 1, 5]]]]]
  ]);
