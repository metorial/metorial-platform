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
import { normalizePath } from '../lib/normalizePath';

let include = {
  repository: true
};

class codeBucketServiceImpl {
  async createCodeBucket(d: {
    instance: Instance;
    purpose: CodeBucketPurpose;
    isReadOnly?: boolean;
    files?: {
      data: string;
      encoding: 'utf-8' | 'base64';
      path: string;
    }[];
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
    } else {
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
  }

  async getCodeBucketFilesWithContent(d: { codeBucket: CodeBucket; prefix?: string }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    return [] as any;
  }

  async getEditorToken(d: { codeBucket: CodeBucket }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    let expiresInSeconds = 60 * 60 * 24 * 7;

    return {
      id: d.codeBucket.id,
      token: '',
      expiresAt: new Date(Date.now() + (expiresInSeconds - 1) * 1000)
    };
  }

  async syncCodeBuckets(d: { source: CodeBucket; target: CodeBucket }) {
    await db.codeBucket.update({
      where: { oid: d.target.oid },
      data: { status: 'importing' }
    });
  }

  async getBucketFilesAsZip(d: { codeBucket: CodeBucket }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    return {} as any;
  }

  async getFile(d: { codeBucket: CodeBucket; path: string }) {
    await this.waitForCodeBucketReady({ codeBucketId: d.codeBucket.id });

    return {} as any;
  }
}

export let codeBucketService = Service.create(
  'codeBucket',
  () => new codeBucketServiceImpl()
).build();
