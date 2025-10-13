import {
  CodeBucket,
  CodeBucketPurpose,
  CodeBucketTemplate,
  db,
  ID,
  Instance,
  ScmRepo
} from '@metorial/db';
import { delay } from '@metorial/delay';
import { badRequestError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import Long from 'long';
import { codeWorkspaceClient } from '../lib/codeWorkspace';
import { normalizePath } from '../lib/normalizePath';
import { cloneBucketQueue } from '../queue/cloneBucket';
import { copyFromToBucketQueue } from '../queue/copyFromToBucket';
import { exportGithubQueue } from '../queue/exportGithub';
import { importGithubQueue } from '../queue/importGithub';
import { importTemplateQueue } from '../queue/importTemplate';

let include = {
  repository: true
};

class codeBucketServiceImpl {
  async createCodeBucket(d: {
    instance: Instance;
    purpose: CodeBucketPurpose;
    isReadOnly?: boolean;
  }) {
    let codeBucket = await db.codeBucket.create({
      data: {
        id: await ID.generateId('codeBucket'),
        instanceOid: d.instance.oid,
        purpose: d.purpose,
        isReadOnly: d.isReadOnly
      },
      include
    });

    return codeBucket;
  }

  async createCodeBucketFromRepo(d: {
    instance: Instance;
    purpose: CodeBucketPurpose;
    repo: ScmRepo;
    path?: string;
    ref?: string;
    isReadOnly?: boolean;
  }) {
    if (d.repo.provider != 'github') {
      throw new ServiceError(
        badRequestError({
          message: 'Only GitHub repositories are supported'
        })
      );
    }

    let codeBucket = await db.codeBucket.create({
      data: {
        id: await ID.generateId('codeBucket'),
        instanceOid: d.instance.oid,
        purpose: d.purpose,
        repositoryOid: d.repo.oid,
        path: normalizePath(d.path ?? '/'),
        status: 'importing',
        isReadOnly: d.isReadOnly
      },
      include
    });

    await importGithubQueue.add({
      newBucketId: codeBucket.id,
      owner: d.repo.externalOwner,
      path: d.path ?? '/',
      repo: d.repo.externalName,
      ref: d.ref ?? d.repo.defaultBranch ?? 'main',
      repoId: d.repo.id
    });

    return codeBucket;
  }

  async cloneCodeBucketTemplate(d: {
    instance: Instance;
    purpose: CodeBucketPurpose;
    template: CodeBucketTemplate;
    isReadOnly?: boolean;
  }) {
    let codeBucket = await db.codeBucket.create({
      data: {
        id: await ID.generateId('codeBucket'),
        instanceOid: d.instance.oid,
        purpose: d.purpose,
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
        id: await ID.generateId('codeBucket'),
        instanceOid: d.codeBucket.instanceOid,
        purpose: d.codeBucket.purpose,
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

  async exportCodeBucketToGithub(d: { codeBucket: CodeBucket; repo: ScmRepo; path: string }) {
    if (d.repo.provider != 'github') {
      throw new ServiceError(
        badRequestError({
          message: 'Only GitHub repositories are supported'
        })
      );
    }

    await exportGithubQueue.add({
      bucketId: d.codeBucket.id,
      repoId: d.repo.id,
      path: d.path
    });
  }

  async getCodeBucketFilesWithContent(d: { codeBucket: CodeBucket; prefix?: string }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    let res = await codeWorkspaceClient.getBucketFilesWithContent({
      bucketId: d.codeBucket.id,
      prefix: d.prefix ?? ''
    });

    return res.files.map(f => ({
      ...f.fileInfo,
      content: f.content
    }));
  }

  async getEditorToken(d: { codeBucket: CodeBucket }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    let expiresInSeconds = 60 * 60 * 24 * 7;

    let res = await codeWorkspaceClient.getBucketToken({
      bucketId: d.codeBucket.id,
      isReadOnly: d.codeBucket.isReadOnly,
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
}

export let codeBucketService = Service.create(
  'codeBucket',
  () => new codeBucketServiceImpl()
).build();
