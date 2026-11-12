import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import Long from 'long';
import type {
  ScmBackend,
  ScmInstallation,
  ScmRepository,
  ScmRepositorySync
} from '../../prisma/generated/client';
import { env } from '../env';
import { getBitbucketAccessTokenWithInstallation } from '../lib/bitbucket';
import { codeBucketClient } from '../lib/codeWorkspace';
import { toExportLineage, type ExportLineage } from '../lib/exportError';
import { getGitHubTransferEndpoints, getInstallationAccessToken } from '../lib/githubApp';
import { getGitLabAccessTokenWithInstallation } from '../lib/gitlab';
import { getBitbucketCloneUrl } from '../queues/codeBucket/bitbucket';
import {
  getRemoteStateKeyPrefix,
  type RepositoryRemoteStateRef
} from './repositoryRemoteState';

let MANIFEST_EXPORT_PATH = '/';

export type ManifestExportSync = ScmRepositorySync & {
  repo: ScmRepository & { installation: ScmInstallation & { backend: ScmBackend } };
};

export type ManifestExportResult = {
  stats: PrismaJson.RepositorySyncResultStats;
  commitsCreated: number;
  writeRequests: number;
  lineage: ExportLineage;
  partial: boolean;
  newRemoteState: RepositoryRemoteStateRef | null;
  retryAfter: Date | null;
};

type ExportResponse = {
  stats?: Record<keyof PrismaJson.RepositorySyncResultStats, number | Long> | null;
  commitsCreated?: number;
  writeRequests?: number;
  startHeadSha?: string;
  lastCommitSha?: string;
  foreignCommits?: boolean;
  partial?: boolean;
  newRemoteState?: RepositoryRemoteStateRef | null;
  retryAfterUnix?: number | Long;
};

let toNumber = (value: number | Long | undefined | null) =>
  value == null ? 0 : typeof value === 'number' ? value : Number(value.toString());

export let emptyManifestExportStats = (): PrismaJson.RepositorySyncResultStats => ({
  filesTotal: 0,
  filesUploaded: 0,
  filesSkipped: 0,
  blobsCreated: 0,
  blobsReused: 0,
  lfsUploaded: 0,
  bytesUploaded: 0,
  deleted: 0,
  unexpectedDeletes: 0,
  githubRequests: 0,
  rateLimitWaitMs: 0,
  commitsCreated: 0,
  batchSizeReductions: 0
});

export let toManifestExportStats = (
  stats:
    | Partial<Record<keyof PrismaJson.RepositorySyncResultStats, number | Long>>
    | null
    | undefined
) => {
  let result = emptyManifestExportStats();
  for (let key of Object.keys(result) as (keyof PrismaJson.RepositorySyncResultStats)[]) {
    result[key] = toNumber(stats?.[key]);
  }
  return result;
};

let toResult = (response: ExportResponse): ManifestExportResult => {
  let retryAfterUnix = toNumber(response.retryAfterUnix);
  let remoteState = response.newRemoteState;

  return {
    stats: toManifestExportStats(response.stats),
    commitsCreated: response.commitsCreated ?? 0,
    writeRequests: response.writeRequests ?? 0,
    lineage: toExportLineage(response),
    partial: response.partial ?? false,
    newRemoteState: remoteState?.commitSha
      ? {
          commitSha: remoteState.commitSha,
          treeSha: remoteState.treeSha,
          listingBucket: remoteState.listingBucket,
          listingKey: remoteState.listingKey,
          entryCount: remoteState.entryCount
        }
      : null,
    retryAfter: retryAfterUnix > 0 ? new Date(retryAfterUnix * 1000) : null
  };
};

class ManifestExportServiceImpl {
  async exportManifestToRepoNow(d: {
    sync: ManifestExportSync;
    writeBudget: number;
    remoteState?: RepositoryRemoteStateRef;
  }): Promise<ManifestExportResult> {
    let sync = d.sync;
    let repo = sync.repo;
    if (!sync.manifestBucket || !sync.manifestKey || !sync.manifestSha256) {
      throw new ServiceError(badRequestError({ message: 'Repository sync has no manifest' }));
    }

    let settings = env.manifestSync;
    let manifest = {
      bucket: sync.manifestBucket,
      key: sync.manifestKey,
      sha256: sync.manifestSha256,
      previousBucket: sync.previousManifestBucket ?? '',
      previousKey: sync.previousManifestKey ?? '',
      previousSha256: sync.previousManifestSha256 ?? '',
      maxUnexpectedDeletes: sync.deletionGuard?.maxUnexpectedDeletes ?? 0,
      maxUnexpectedDeleteRatio: sync.deletionGuard?.maxUnexpectedDeleteRatio ?? 0,
      allowMassDelete: sync.allowMassDelete,
      writeBudget: d.writeBudget,
      sliceSeconds: settings.ORIGIN_EXPORT_SLICE_SECONDS,
      remoteState: d.remoteState,
      tuning: {
        graphqlMaxFileBytes: Long.fromNumber(settings.ORIGIN_GITHUB_GRAPHQL_MAX_FILE_BYTES),
        restMaxBlobBytes: Long.fromNumber(settings.ORIGIN_GITHUB_REST_MAX_BLOB_BYTES),
        batchInitialBytes: Long.fromNumber(settings.ORIGIN_GITHUB_BATCH_INITIAL_BYTES),
        batchMaxBytes: Long.fromNumber(settings.ORIGIN_GITHUB_BATCH_MAX_BYTES)
      },
      remoteStateKeyPrefix: getRemoteStateKeyPrefix(repo)
    };
    let common = {
      bucketId: '',
      path: MANIFEST_EXPORT_PATH,
      branch: sync.branchName,
      commitMessage: sync.title,
      deletePaths: [],
      explicitDeletesOnly: false,
      lfsThresholdBytes: Long.fromNumber(sync.gitLfsThresholdBytes ?? 0),
      manifest
    };

    if (repo.provider === 'github') {
      if (!repo.installation.externalInstallationId) {
        throw new ServiceError(badRequestError({ message: 'Installation ID not found' }));
      }

      let token = await getInstallationAccessToken(
        repo.installation.externalInstallationId,
        repo.installation.backend
      );
      return toResult(
        await codeBucketClient.exportBucketToGithub({
          ...common,
          ...getGitHubTransferEndpoints(
            repo.installation.backend,
            repo.externalOwner,
            repo.externalName
          ),
          owner: repo.externalOwner,
          repo: repo.externalName,
          token
        })
      );
    }

    if (repo.provider === 'gitlab') {
      let token = await getGitLabAccessTokenWithInstallation(repo.installation);
      return toResult(
        await codeBucketClient.exportBucketToGitlab({
          ...common,
          projectId: Long.fromString(repo.externalId),
          token,
          gitlabApiUrl: repo.installation.backend.apiUrl
        })
      );
    }

    if (repo.provider === 'bitbucket') {
      let token = await getBitbucketAccessTokenWithInstallation(repo.installation);
      if (repo.installation.backend.type === 'bitbucket_data_center') {
        return toResult(
          await codeBucketClient.exportBucketToBitbucketDataCenter({
            ...common,
            cloneUrl: getBitbucketCloneUrl(repo),
            username: '',
            token
          })
        );
      }

      return toResult(
        await codeBucketClient.exportBucketToBitbucketCloud({
          ...common,
          workspace: repo.externalOwner,
          repo: repo.externalName,
          token,
          bitbucketApiUrl: repo.installation.backend.apiUrl,
          bitbucketWebUrl: repo.installation.backend.webUrl
        })
      );
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
  }
}

export let manifestExportService = Service.create(
  'manifestExportService',
  () => new ManifestExportServiceImpl()
).build();
