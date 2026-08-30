import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { type CodeBucket, db, type Environment, type Tenant } from '@metorial-subspace/db';
import { Fabric } from '@metorial/fabric';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveCustomProviderDeployments,
  resolveCustomProviders,
  resolveCustomProviderVersions
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  toProviderEventBase,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { getTenantForOrigin, origin } from '../origin';

let include = { scmRepo: true };

type ListBucketsParams = {
  createdAt?: DateFilter;
  updatedAt?: DateFilter;

  ids?: string[];
  customProviderIds?: string[];
  customProviderVersionIds?: string[];
  customProviderDeploymentIds?: string[];
};

type GetBucketByIdParams = {
  bucketId: string;
};

type GetFilesInBucketParams = {
  bucket: CodeBucket;
  prefix?: string;
};

type GetFileInBucketParams = {
  bucket: CodeBucket;
  filename: string;
};

type SetFileInBucketParams = {
  bucket: CodeBucket;
  filename: string;
  content: string;
  encoding: 'utf-8' | 'base64';
};

type DeleteFileInBucketParams = {
  bucket: CodeBucket;
  filename: string;
};

type GetZipUrlParams = {
  bucket: CodeBucket;
};

type GetEditorUrlParams = {
  bucket: CodeBucket;
};

class bucketServiceImpl {
  async listBuckets(d: MetorialFacing<ListBucketsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listBucketsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listBucketsInternal(
    d: { tenant: Tenant; environment: Environment } & ListBucketsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let customProviders = await resolveCustomProviders(ts, d.customProviderIds);
    let customProviderVersions = await resolveCustomProviderVersions(
      ts,
      d.customProviderVersionIds
    );
    let customProviderDeployments = await resolveCustomProviderDeployments(
      ts,
      d.customProviderDeploymentIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.codeBucket.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                customProviders
                  ? { customProviders: { some: customProviders.oidIn } }
                  : undefined!,
                customProviderVersions
                  ? {
                      customProviderDeployments: {
                        some: customProviderVersions.oidIn
                      }
                    }
                  : undefined!,
                customProviderDeployments
                  ? {
                      customProviderDeployments: {
                        some: customProviderDeployments.oidIn
                      }
                    }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getBucketById(d: MetorialFacing<GetBucketByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getBucketByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getBucketByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetBucketByIdParams
  ) {
    let solution = await getMetorialSolution();
    let codeBucket = await db.codeBucket.findFirst({
      where: {
        id: d.bucketId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid
      },
      include
    });
    if (!codeBucket) throw new ServiceError(notFoundError('bucket', d.bucketId));

    return codeBucket;
  }

  async getFilesInBucket(d: MetorialFacing<GetFilesInBucketParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getFilesInBucketInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async getFilesInBucketInternal(d: { tenant: Tenant } & GetFilesInBucketParams) {
    let tenant = await getTenantForOrigin(d.tenant);
    let files = await origin.codeBucket.getFiles({
      tenantId: tenant.id,
      codeBucketId: d.bucket.id,
      prefix: d.prefix,
      excludeContents: true
    });

    return files.files.map(
      (f: { path: string; size: string; contentType: string; modifiedAt: Date }) => ({
        filename: f.path,
        size: Number.parseInt(f.size, 10),
        contentType: f.contentType,
        modifiedAt: f.modifiedAt
      })
    );
  }

  async getFileInBucket(d: MetorialFacing<GetFileInBucketParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getFileInBucketInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async getFileInBucketInternal(d: { tenant: Tenant } & GetFileInBucketParams) {
    let tenant = await getTenantForOrigin(d.tenant);
    let file = await origin.codeBucket.getFile({
      tenantId: tenant.id,
      codeBucketId: d.bucket.id,
      path: d.filename
    });

    return {
      filename: file.path,
      size: Number.parseInt(file.size, 10),
      contentType: file.contentType,
      modifiedAt: file.modifiedAt,
      content: file.content,
      encoding: file.encoding
    };
  }

  async setFileInBucket(d: MetorialFacing<SetFileInBucketParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.custom_provider.code_bucket.file.written:before', eventBase);

    let result = await this.setFileInBucketInternal({
      ...rest,
      tenant: scope.tenant
    });

    await Fabric.fire('provider.custom_provider.code_bucket.file.written:after', {
      ...eventBase,
      file: {
        bucket: { id: d.bucket.id },
        filename: d.filename,
        byteSize: Buffer.byteLength(d.content, d.encoding)
      }
    });

    return result;
  }

  async setFileInBucketInternal(d: { tenant: Tenant } & SetFileInBucketParams) {
    let tenant = await getTenantForOrigin(d.tenant);
    await origin.codeBucket.setFile({
      tenantId: tenant.id,
      codeBucketId: d.bucket.id,
      path: d.filename,
      data: d.content,
      encoding: d.encoding
    });

    return {
      filename: d.filename,
      size: d.content.length,
      contentType: 'application/octet-stream',
      modifiedAt: new Date(),
      content: d.content,
      encoding: d.encoding
    };
  }

  async deleteFileInBucket(d: MetorialFacing<DeleteFileInBucketParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.custom_provider.code_bucket.file.deleted:before', eventBase);

    let result = await this.deleteFileInBucketInternal({
      ...rest,
      tenant: scope.tenant
    });

    await Fabric.fire('provider.custom_provider.code_bucket.file.deleted:after', {
      ...eventBase,
      file: { bucket: { id: d.bucket.id }, filename: d.filename, byteSize: null }
    });

    return result;
  }

  async deleteFileInBucketInternal(d: { tenant: Tenant } & DeleteFileInBucketParams) {
    let tenant = await getTenantForOrigin(d.tenant);
    await origin.codeBucket.deleteFile({
      tenantId: tenant.id,
      codeBucketId: d.bucket.id,
      path: d.filename
    });

    return {
      filename: d.filename,
      size: 0,
      contentType: 'application/octet-stream',
      modifiedAt: new Date()
    };
  }

  async getZipUrl(d: MetorialFacing<GetZipUrlParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getZipUrlInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async getZipUrlInternal(d: { tenant: Tenant } & GetZipUrlParams) {
    let tenant = await getTenantForOrigin(d.tenant);
    let res = await origin.codeBucket.getAsZip({
      tenantId: tenant.id,
      codeBucketId: d.bucket.id
    });

    return res;
  }

  async getEditorUrl(d: MetorialFacing<GetEditorUrlParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getEditorUrlInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async getEditorUrlInternal(d: { tenant: Tenant } & GetEditorUrlParams) {
    let tenant = await getTenantForOrigin(d.tenant);
    let res = await origin.codeBucket.getEditorToken({
      tenantId: tenant.id,
      codeBucketId: d.bucket.id
    });

    return {
      url: res.url,
      expiresAt: res.expiresAt
    };
  }
}

export let bucketService = Service.create('bucket', () => new bucketServiceImpl()).build();
