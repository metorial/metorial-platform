import {
  CodeBucket,
  CodeBucketPurpose,
  CodeBucketTemplate,
  db,
  ID,
  Instance
} from '@metorial/db';
import { Service } from '@metorial/service';
import Long from 'long';
import { codeWorkspaceClient } from '../lib/codeWorkspace';

class codeBucketServiceImpl {
  async createCodeBucket(d: { instance: Instance; purpose: CodeBucketPurpose }) {
    let codeBucket = await db.codeBucket.create({
      data: {
        id: await ID.generateId('codeBucket'),
        instanceOid: d.instance.oid,
        purpose: d.purpose
      }
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
      }
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

  async cloneCodeBucket(d: { codeBucket: CodeBucket }) {
    let codeBucket = await db.codeBucket.create({
      data: {
        id: await ID.generateId('codeBucket'),
        instanceOid: d.codeBucket.instanceOid,
        purpose: d.codeBucket.purpose,
        parentOid: d.codeBucket.oid
      }
    });

    await codeWorkspaceClient.cloneBucket({
      sourceBucketId: d.codeBucket.id,
      newBucketId: codeBucket.id
    });

    return codeBucket;
  }

  async getCodeBucketFilesWithContent(d: { codeBucket: CodeBucket; prefix?: string }) {
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
