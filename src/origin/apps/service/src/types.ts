import type { ScmProvider } from '../prisma/generated/client';

export interface ScmRepoPreview {
  provider: ScmProvider;
  name: String;
  identifier: String;
  externalId: string;
  createdAt: Date;
  updatedAt: Date;
  lastPushedAt: Date | null;
  account: {
    externalId: string;
    name: string;
    identifier: string;
    provider: ScmProvider;
  };
}

export interface ScmAccountPreview {
  provider: ScmProvider;
  externalId: string;
  name: string;
  identifier: string;
}
