import { ScmProvider } from '@metorial/db';

export interface ScmRepoPreview {
  provider: ScmProvider;
  name: String;
  identifier: String;
  externalId: string;
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
