import { delay } from '@lowerdeck/delay';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import Long from 'long';
import type { ScmRepository } from '../../prisma/generated/browser';
import type { CodeBucket, CodeBucketTemplate, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { getBitbucketAccessTokenWithInstallation } from '../lib/bitbucket';
import { codeBucketClient } from '../lib/codeWorkspace';
import { getInstallationAccessToken } from '../lib/githubApp';
import { getGitLabAccessTokenWithInstallation } from '../lib/gitlab';
import { normalizePath } from '../lib/normalizePath';
import { getBitbucketCloneUrl } from '../queues/codeBucket/bitbucket';
import { cloneBucketQueue } from '../queues/codeBucket/cloneBucket';
import { copyFromToBucketQueue } from '../queues/codeBucket/copyFromToBucket';
import { exportBitbucketQueue } from '../queues/codeBucket/exportBitbucket';
import { exportGithubQueue } from '../queues/codeBucket/exportGithub';
import { exportGitlabQueue } from '../queues/codeBucket/exportGitlab';
import { importBitbucketQueue } from '../queues/codeBucket/importBitbucket';
import { importGithubQueue } from '../queues/codeBucket/importGithub';
import { importGitlabQueue } from '../queues/codeBucket/importGitlab';
import { importTemplateQueue } from '../queues/codeBucket/importTemplate';
import { codeBucketPurposeService } from './codeBucketPurpose';

let include = {
  repository: { include: { account: true } }
};

class codeBucketServiceImpl {
  async getCodeBucketById(d: { tenant: Tenant; id: string }) {
    let codeBucket = await db.codeBucket.findFirst({
      where: { OR: [{ id: d.id }] },
      include
    });
    if (!codeBucket) throw new ServiceError(notFoundError('codeBucket'));
    return codeBucket;
  }

  async createCodeBucket(d: {
    tenant: Tenant;
    purpose: string;
    isReadOnly?: boolean;
    files?: {
      data: string;
      encoding: 'utf-8' | 'base64';
      path: string;
    }[];
  }) {
    let codeBucket = await db.codeBucket.create({
      data: {
        ...getId('codeBucket'),
        tenantOid: d.tenant.oid,
        purposeOid: await codeBucketPurposeService.ensurePurpose(d),
        isReadOnly: d.isReadOnly
      },
      include
    });

    if (d.files && d.files.length > 0) {
      await codeBucketClient.createBucketFromContents({
        newBucketId: codeBucket.id,
        contents: d.files.map(f => ({
          path: normalizePath(f.path),
          content:
            f.encoding === 'base64'
              ? Buffer.from(f.data, 'base64')
              : Buffer.from(f.data, 'utf-8')
        }))
      });
    }

    return codeBucket;
  }

  async createCodeBucketFromRepo(d: {
    tenant: Tenant;
    purpose: string;
    repo: ScmRepository;
    path?: string;
    ref?: string;
    isReadOnly?: boolean;
    isSynced?: boolean;
  }) {
    let ref = d.ref ?? d.repo.defaultBranch ?? 'main';

    let codeBucket = await db.codeBucket.create({
      data: {
        ...getId('codeBucket'),
        tenantOid: d.tenant.oid,
        purposeOid: await codeBucketPurposeService.ensurePurpose(d),
        repositoryOid: d.repo.oid,
        path: normalizePath(d.path ?? '/'),
        status: 'importing',
        isReadOnly: d.isReadOnly,
        isSynced: d.isSynced ?? false,
        syncRef: d.isSynced ? ref : null
      },
      include
    });

    if (d.repo.provider === 'github') {
      await importGithubQueue.add({
        newBucketId: codeBucket.id,
        owner: d.repo.externalOwner,
        path: d.path ?? '/',
        repo: d.repo.externalName,
        ref,
        repoId: d.repo.id
      });
    } else if (d.repo.provider === 'gitlab') {
      await importGitlabQueue.add({
        newBucketId: codeBucket.id,
        owner: d.repo.externalOwner,
        path: d.path ?? '/',
        repo: d.repo.externalName,
        ref,
        repoId: d.repo.id
      });
    } else if (d.repo.provider === 'bitbucket') {
      await importBitbucketQueue.add({
        newBucketId: codeBucket.id,
        path: d.path ?? '/',
        ref,
        repoId: d.repo.id
      });
    } else {
      throw new ServiceError(
        badRequestError({
          message: 'Unsupported repository provider'
        })
      );
    }

    return codeBucket;
  }

  async syncCodeBucketFromRepo(d: { codeBucket: CodeBucket; repo: ScmRepository }) {
    if (!d.codeBucket.isSynced) {
      throw new ServiceError(
        badRequestError({
          message: 'Bucket is not configured for syncing'
        })
      );
    }

    // Set status to importing to prevent clone conflicts
    await db.codeBucket.update({
      where: { oid: d.codeBucket.oid },
      data: { status: 'importing' }
    });

    if (d.repo.provider === 'github') {
      await importGithubQueue.add({
        newBucketId: d.codeBucket.id,
        owner: d.repo.externalOwner,
        path: d.codeBucket.path ?? '/',
        repo: d.repo.externalName,
        ref: d.codeBucket.syncRef ?? d.repo.defaultBranch ?? 'main',
        repoId: d.repo.id
      });
    } else if (d.repo.provider === 'gitlab') {
      await importGitlabQueue.add({
        newBucketId: d.codeBucket.id,
        owner: d.repo.externalOwner,
        path: d.codeBucket.path ?? '/',
        repo: d.repo.externalName,
        ref: d.codeBucket.syncRef ?? d.repo.defaultBranch ?? 'main',
        repoId: d.repo.id
      });
    } else if (d.repo.provider === 'bitbucket') {
      await importBitbucketQueue.add({
        newBucketId: d.codeBucket.id,
        path: d.codeBucket.path ?? '/',
        ref: d.codeBucket.syncRef ?? d.repo.defaultBranch ?? 'main',
        repoId: d.repo.id
      });
    } else {
      throw new ServiceError(
        badRequestError({
          message: 'Unsupported repository provider'
        })
      );
    }
  }

  async cloneCodeBucketTemplate(d: {
    tenant: Tenant;
    purpose: string;
    template: CodeBucketTemplate;
    isReadOnly?: boolean;
  }) {
    let codeBucket = await db.codeBucket.create({
      data: {
        ...getId('codeBucket'),
        tenantOid: d.tenant.oid,
        purposeOid: await codeBucketPurposeService.ensurePurpose(d),
        templateOid: d.template.oid,
        isReadOnly: d.isReadOnly,
        status: 'importing'
      },
      include
    });

    if (d.template.providerBucketOid) {
      let providerBucket = await db.codeBucket.findFirstOrThrow({
        where: { oid: d.template.providerBucketOid }
      });

      await copyFromToBucketQueue.add({
        sourceBucketId: providerBucket.id,
        targetBucketId: codeBucket.id
      });
    } else {
      await importTemplateQueue.add({
        bucketId: codeBucket.id,
        templateId: d.template.id
      });
    }

    return codeBucket;
  }

  async waitForCodeBucketReady(d: { codeBucketId: string }) {
    let currentBucket = await db.codeBucket.findFirstOrThrow({
      where: { id: d.codeBucketId }
    });
    while (currentBucket.status === 'importing') {
      await delay(1000);
      currentBucket = await db.codeBucket.findFirstOrThrow({
        where: { id: d.codeBucketId }
      });
    }
  }

  async cloneCodeBucket(d: { codeBucket: CodeBucket; isReadOnly?: boolean }) {
    let codeBucket = await db.codeBucket.create({
      data: {
        ...getId('codeBucket'),
        tenantOid: d.codeBucket.tenantOid,
        purposeOid: d.codeBucket.purposeOid,
        parentOid: d.codeBucket.oid,
        isReadOnly: d.isReadOnly,
        status: 'importing'
      },
      include
    });

    await cloneBucketQueue.add({
      bucketId: codeBucket.id
    });

    return codeBucket;
  }

  async exportCodeBucketToRepo(d: {
    codeBucket: CodeBucket;
    repo: ScmRepository;
    path: string;
    branchName?: string;
    commitMessage?: string;
  }) {
    if (d.repo.provider === 'github') {
      await exportGithubQueue.add({
        bucketId: d.codeBucket.id,
        repoId: d.repo.id,
        path: d.path,
        branchName: d.branchName,
        commitMessage: d.commitMessage
      });
    } else if (d.repo.provider === 'gitlab') {
      await exportGitlabQueue.add({
        bucketId: d.codeBucket.id,
        repoId: d.repo.id,
        path: d.path,
        branchName: d.branchName,
        commitMessage: d.commitMessage
      });
    } else if (d.repo.provider === 'bitbucket') {
      await exportBitbucketQueue.add({
        bucketId: d.codeBucket.id,
        repoId: d.repo.id,
        path: d.path,
        branchName: d.branchName,
        commitMessage: d.commitMessage
      });
    } else {
      throw new ServiceError(
        badRequestError({
          message: 'Unsupported repository provider'
        })
      );
    }
  }

  async exportCodeBucketToRepoNow(d: {
    codeBucket: CodeBucket;
    repo: ScmRepository;
    path: string;
    branchName?: string;
    commitMessage?: string;
  }) {
    let repo = await db.scmRepository.findFirstOrThrow({
      where: { oid: d.repo.oid },
      include: { installation: { include: { backend: true } } }
    });
    let branch = d.branchName ?? repo.defaultBranch ?? 'main';
    let commitMessage = d.commitMessage ?? `Export code bucket ${d.codeBucket.id}`;

    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    if (repo.provider === 'github') {
      if (!repo.installation.externalInstallationId) {
        throw new ServiceError(badRequestError({ message: 'Installation ID not found' }));
      }

      let token = await getInstallationAccessToken(
        repo.installation.externalInstallationId,
        repo.installation.backend
      );

      await codeBucketClient.exportBucketToGithub({
        bucketId: d.codeBucket.id,
        owner: repo.externalOwner,
        repo: repo.externalName,
        path: d.path,
        token,
        branch,
        commitMessage
      });
      return;
    }

    if (repo.provider === 'gitlab') {
      let token = await getGitLabAccessTokenWithInstallation(repo.installation);

      await codeBucketClient.exportBucketToGitlab({
        bucketId: d.codeBucket.id,
        projectId: Long.fromString(repo.externalId),
        path: d.path,
        token,
        gitlabApiUrl: repo.installation.backend.apiUrl,
        branch,
        commitMessage
      });
      return;
    }

    if (repo.provider === 'bitbucket') {
      let token = await getBitbucketAccessTokenWithInstallation(repo.installation);
      if (repo.installation.backend.type === 'bitbucket_data_center') {
        await codeBucketClient.exportBucketToBitbucketDataCenter({
          bucketId: d.codeBucket.id,
          cloneUrl: getBitbucketCloneUrl(repo),
          path: d.path,
          username: '',
          token,
          branch,
          commitMessage
        });
      } else {
        await codeBucketClient.exportBucketToBitbucketCloud({
          bucketId: d.codeBucket.id,
          workspace: repo.externalOwner,
          repo: repo.externalName,
          path: d.path,
          token,
          bitbucketApiUrl: repo.installation.backend.apiUrl,
          bitbucketWebUrl: repo.installation.backend.webUrl,
          branch,
          commitMessage
        });
      }
      return;
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
  }

  async getCodeBucketFiles(d: { codeBucket: CodeBucket; prefix?: string }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    let res = await codeBucketClient.getBucketFiles({
      bucketId: d.codeBucket.id,
      prefix: d.prefix ?? ''
    });

    return res.files.map((f: any) => ({
      path: f.path,
      size: f.size,
      contentType: f.contentType,
      modifiedAt: f.modifiedAt
    }));
  }

  async getCodeBucketFilesWithContent(d: { codeBucket: CodeBucket; prefix?: string }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    let res = await codeBucketClient.getBucketFilesWithContent({
      bucketId: d.codeBucket.id,
      prefix: d.prefix ?? ''
    });

    return res.files
      .filter((f: any) => f.fileInfo !== undefined)
      .map((f: any) => ({
        path: f.fileInfo!.path,
        size: f.fileInfo!.size,
        contentType: f.fileInfo!.contentType,
        modifiedAt: f.fileInfo!.modifiedAt,
        content: f.content
      }));
  }

  async getEditorToken(d: { codeBucket: CodeBucket; isReadOnly?: boolean }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    let expiresInSeconds = 60 * 60 * 24 * 7;

    let res = await codeBucketClient.getBucketToken({
      bucketId: d.codeBucket.id,
      isReadOnly: d.isReadOnly ?? d.codeBucket.isReadOnly,
      expiresInSeconds: Long.fromNumber(expiresInSeconds)
    });

    return {
      id: d.codeBucket.id,
      token: res.token,
      expiresAt: new Date(Date.now() + (expiresInSeconds - 1) * 1000)
    };
  }

  async syncCodeBuckets(d: { source: CodeBucket; target: CodeBucket }) {
    await db.codeBucket.update({
      where: { oid: d.target.oid },
      data: { status: 'importing' }
    });

    await copyFromToBucketQueue.add({
      sourceBucketId: d.source.id,
      targetBucketId: d.target.id
    });
  }

  async getBucketFilesAsZip(d: { codeBucket: CodeBucket }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    let res = await codeBucketClient.getBucketFilesAsZip({
      bucketId: d.codeBucket.id,
      prefix: ''
    });

    return res;
  }

  async getFile(d: { codeBucket: CodeBucket; path: string }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    let res = await codeBucketClient.getBucketFile({
      bucketId: d.codeBucket.id,
      path: d.path
    });

    if (!res.content || !res.content.fileInfo) {
      throw new ServiceError(notFoundError('file'));
    }

    return {
      ...res.content.fileInfo,
      content: res.content.content
    };
  }

  async setFiles(d: {
    codeBucket: CodeBucket;
    files: {
      path: string;
      data: string;
      encoding: 'utf-8' | 'base64';
    }[];
  }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    if (d.codeBucket.isReadOnly) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot modify files in a read-only code bucket'
        })
      );
    }

    await codeBucketClient.setBucketFiles({
      bucketId: d.codeBucket.id,
      files: d.files.map(f => ({
        path: normalizePath(f.path),
        content:
          f.encoding === 'base64'
            ? Buffer.from(f.data, 'base64')
            : Buffer.from(f.data, 'utf-8')
      }))
    });
  }

  async setFile(d: {
    codeBucket: CodeBucket;
    path: string;
    data: string;
    encoding: 'utf-8' | 'base64';
  }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    if (d.codeBucket.isReadOnly) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot modify files in a read-only code bucket'
        })
      );
    }

    await codeBucketClient.setBucketFile({
      bucketId: d.codeBucket.id,
      path: normalizePath(d.path),
      content:
        d.encoding === 'base64' ? Buffer.from(d.data, 'base64') : Buffer.from(d.data, 'utf-8')
    });
  }

  async deleteFile(d: { codeBucket: CodeBucket; path: string }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    if (d.codeBucket.isReadOnly) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot modify files in a read-only code bucket'
        })
      );
    }

    await codeBucketClient.deleteBucketFile({
      bucketId: d.codeBucket.id,
      path: normalizePath(d.path)
    });
  }

  async deletePath(d: { codeBucket: CodeBucket; path: string }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    if (d.codeBucket.isReadOnly) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot modify files in a read-only code bucket'
        })
      );
    }

    await codeBucketClient.deleteBucketPath({
      bucketId: d.codeBucket.id,
      path: normalizePath(d.path)
    });
  }
}

export let codeBucketService = Service.create(
  'codeBucket',
  () => new codeBucketServiceImpl()
).build();
