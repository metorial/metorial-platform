import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type CodeBucket,
  db,
  type Environment,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveCustomProviderDeployments,
  resolveCustomProviders,
  resolveCustomProviderVersions
} from '@metorial-subspace/list-utils';
import { getTenantForOrigin, origin } from '../origin';

let include = { scmRepo: true };

class bucketServiceImpl {
  async listBuckets(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    createdAt?: DateFilter;
    updatedAt?: DateFilter;

    ids?: string[];
    customProviderIds?: string[];
    customProviderVersionIds?: string[];
    customProviderDeploymentIds?: string[];
  }) {
    let customProviders = await resolveCustomProviders(d, d.customProviderIds);
    let customProviderVersions = await resolveCustomProviderVersions(
      d,
      d.customProviderVersionIds
    );
    let customProviderDeployments = await resolveCustomProviderDeployments(
      d,
      d.customProviderDeploymentIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.codeBucket.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

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

  async getBucketById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    bucketId: string;
  }) {
    let codeBucket = await db.codeBucket.findFirst({
      where: {
        id: d.bucketId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!codeBucket) throw new ServiceError(notFoundError('bucket', d.bucketId));

    return codeBucket;
  }

  async getFilesInBucket(d: { tenant: Tenant; bucket: CodeBucket; prefix?: string }) {
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

  async getFileInBucket(d: { tenant: Tenant; bucket: CodeBucket; filename: string }) {
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

  async setFileInBucket(d: {
    tenant: Tenant;
    bucket: CodeBucket;
    filename: string;
    content: string;
    encoding: 'utf-8' | 'base64';
  }) {
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

  async deleteFileInBucket(d: { tenant: Tenant; bucket: CodeBucket; filename: string }) {
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

  async getZipUrl(d: { tenant: Tenant; bucket: CodeBucket }) {
    let tenant = await getTenantForOrigin(d.tenant);
    let res = await origin.codeBucket.getAsZip({
      tenantId: tenant.id,
      codeBucketId: d.bucket.id
    });

    return res;
  }

  async getEditorUrl(d: { tenant: Tenant; bucket: CodeBucket }) {
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
