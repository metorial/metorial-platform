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
import { exportGithubQueue } from '../queue/exportGithub';
import { importGithubQueue } from '../queue/importGithub';

let include = {
  repository: true
};

class codeBucketServiceImpl {
  async createCodeBucket(d: { instance: Instance; purpose: CodeBucketPurpose }) {
    let codeBucket = await db.codeBucket.create({
      data: {
        id: await ID.generateId('codeBucket'),
        instanceOid: d.instance.oid,
        purpose: d.purpose
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
        status: 'importing'
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
  }) {
    let codeBucket = await db.codeBucket.create({
      data: {
        id: await ID.generateId('codeBucket'),
        instanceOid: d.instance.oid,
        purpose: d.purpose,
        templateOid: d.template.oid
      },
      include
    });

    await codeWorkspaceClient.createBucketFromContents({
      newBucketId: codeBucket.id,
      contents: d.template.contents.map(f => ({
        path: f.path,
        content: Buffer.from(f.content, 'utf-8')
      }))
    });

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

  async cloneCodeBucket(d: { codeBucket: CodeBucket }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    let codeBucket = await db.codeBucket.create({
      data: {
        id: await ID.generateId('codeBucket'),
        instanceOid: d.codeBucket.instanceOid,
        purpose: d.codeBucket.purpose,
        parentOid: d.codeBucket.oid
      },
      include
    });

    await codeWorkspaceClient.cloneBucket({
      sourceBucketId: d.codeBucket.id,
      newBucketId: codeBucket.id
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
      expiresInSeconds: Long.fromNumber(expiresInSeconds)
    });

    return {
      id: d.codeBucket.id,
      token: res.token,
      expiresAt: new Date(Date.now() + (expiresInSeconds - 1) * 1000)
    };
  }
}

export let codeBucketService = Service.create(
  'codeBucket',
  () => new codeBucketServiceImpl()
).build();
