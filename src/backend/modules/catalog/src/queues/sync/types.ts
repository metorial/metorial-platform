export interface IndexVendor {
  identifier: string;
  name: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
}

export interface IndexCategory {
  identifier: string;
  name: string;
  description: string;
}

export interface IndexServerProvider {
  identifier: string;
  name: string;
  description: string;
  websiteUrl: string;
  imageUrl: string;
}

export interface IndexRepository {
  identifier: string;
  slug: string;
  name: string;
  providerUrl: string;
  websiteUrl: string;
  provider: string;
  providerId: string;
  providerFullIdentifier: string;
  providerIdentifier: string;
  providerOwnerId: string;
  providerOwnerIdentifier: string;
  providerOwnerUrl: string;
  isFork: number;
  isArchived: number;
  starCount: number;
  forkCount: number;
  watcherCount: number;
  openIssuesCount: number;
  subscriptionCount: number;
  size: number;
  defaultBranch: string;
  licenseName: string;
  licenseUrl: string;
  licenseSpdxId: string;
  topics: string[];
  language: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
}

export interface IndexServer {
  identifier: string;
  fullSlug: string;
  slug: string;
  name: string;
  description: string;
  subdirectory: string;
  websiteUrl: string;
  isOfficial: number;
  isCommunity: number;
  isHostable: number;
  readme: string;
  vendorIdentifier: string;
  repositoryIdentifier: string;
  skills: string;
  tools: string | null;
}

export interface IndexServerVariant {
  identifier: string;
  sourceType: 'docker' | 'remote';
  providerIdentifier: string;
  dockerImage: string | null;
  remoteUrl: string | null;
}

export interface IndexServerVersion {
  identifier: string;
  sourceType: 'docker' | 'remote';
  dockerImage: string | null;
  dockerTag: string | null;
  remoteUrl: string | null;
  config: any;
  getLaunchParams: string;
  createdAt: string;
}
