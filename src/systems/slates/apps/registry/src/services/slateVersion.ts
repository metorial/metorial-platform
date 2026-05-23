import {
  forbiddenError,
  notFoundError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@mtsrc/error';
import { createLock } from '@mtsrc/lock';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type {
  Slate,
  SlateAccess,
  SlateVersionBackend,
  User
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId, ID, snowflake } from '../id';
import {
  createZipBuffer,
  readTarballEntries,
  readZipEntries
} from '../lib/slatePackage/archive';
import { normalizeSlatePackage } from '../lib/slatePackage/manifest';
import { getSlateVersionPromotion } from '../lib/slateVersion/promotion';
import { storage } from '../storage';

let include = {
  slate: {
    include: {
      scope: true,
      tenant: true,
      createdByUser: { include: { scope: true } }
    }
  },
  bundleArtifact: true,
  createdByUser: { include: { scope: true } },
  slateDocuments: true
};

let getSlateVersionVisibilityWhere = (supportsPrebuilt = true) =>
  supportsPrebuilt ? {} : { backend: 'local_unbuilt' as const };

let packageLock = createLock({
  name: 'sreg/slate/pub',
  redisUrl: env.service.REDIS_URL
});

class slateVersionServiceImpl {
  async publishSlateVersion(d: {
    user: User;
    input: {
      identifier: {
        scopeIdentifier: string;
        slateIdentifier: string;
      } | null;
      contentBase64: string;
      access: SlateAccess;
      versionOverride?: string;
    };
  }) {
    let buffer = Buffer.from(d.input.contentBase64, 'base64');
    let entries = await readZipEntries(buffer);
    let slatePackage = normalizeSlatePackage({
      entries,
      identifier: d.input.identifier,
      versionOverride: d.input.versionOverride
    });

    return this.publishNormalizedSlateVersion({
      user: d.user,
      input: {
        access: d.input.access,
        backend: 'local_unbuilt',
        bundleBuffer: buffer,
        slatePackage
      }
    });
  }

  async importSlateVersionFromNpmTarball(d: {
    user: User;
    input: {
      tarballBuffer: Buffer;
      access: SlateAccess;
    };
  }) {
    let entries = await readTarballEntries(d.input.tarballBuffer);
    let slatePackage = normalizeSlatePackage({
      entries,
      identifier: null
    });
    let bundleBuffer = await createZipBuffer(entries);

    return this.publishNormalizedSlateVersion({
      user: d.user,
      input: {
        access: d.input.access,
        backend: 'npm',
        bundleBuffer,
        npmPackageName: slatePackage.npmPackageName,
        slatePackage
      }
    });
  }

  async publishNormalizedSlateVersion(d: {
    user: User;
    input: {
      access: SlateAccess;
      backend: SlateVersionBackend;
      bundleBuffer: Buffer;
      npmPackageName?: string;
      slatePackage: ReturnType<typeof normalizeSlatePackage>;
    };
  }) {
    let slateJson = d.input.slatePackage.manifest;

    return packageLock.usingLock(slateJson.name, () =>
      db.$transaction(async db => {
        if (d.input.access === 'public' && env.access.PUBLIC_ACCESS_PERMITTED === false) {
          throw new ServiceError(
            forbiddenError({
              message: 'Public access is not permitted on this tenant.'
            })
          );
        }

        if (d.user.access !== 'read_write') {
          throw new ServiceError(
            unauthorizedError({
              message: 'User does not have permission to publish slates.'
            })
          );
        }

        let scope = await db.scope.findFirst({
          where: {
            identifier: d.input.slatePackage.scopeIdentifier,
            status: 'active'
          }
        });
        if (!scope) throw new ServiceError(notFoundError('scope'));

        if (scope.tenantOid !== d.user.tenantOid) {
          throw new ServiceError(
            forbiddenError({
              message: 'Cannot publish slates to a scope outside of your tenant.'
            })
          );
        }

        let slate = await db.slate.findFirst({
          where: {
            identifier: d.input.slatePackage.slateIdentifier,
            scopeOid: scope.oid,
            tenantOid: d.user.tenantOid
          },
          include: {
            unbuiltCurrentVersion: true,
            builtOrUnbuiltCurrentVersion: true
          }
        });
        if (slate?.status === 'deleted') {
          throw new ServiceError(
            preconditionFailedError({
              message: 'Cannot publish to a slate that has been deleted.'
            })
          );
        }

        if (!slate) {
          slate = await db.slate.create({
            data: {
              ...getId('slate'),
              status: 'active',
              access: d.input.access,

              identifier: d.input.slatePackage.slateIdentifier,
              fullIdentifier: d.input.slatePackage.fullIdentifier,
              name: d.input.slatePackage.slateIdentifier,

              scopeOid: scope.oid,
              tenantOid: d.user.tenantOid,
              createdByUserOid: d.user.oid
            },
            include: {
              unbuiltCurrentVersion: true,
              builtOrUnbuiltCurrentVersion: true
            }
          });
        }

        slate = await db.slate.update({
          where: { oid: slate.oid },
          data: {
            access: d.input.access,
            name: d.input.slatePackage.slateIdentifier,
            description: slateJson.description,
            skills: slateJson.skills,
            logoUrl: slateJson.logoUrl
          },
          include: {
            unbuiltCurrentVersion: true,
            builtOrUnbuiltCurrentVersion: true
          }
        });

        let promotion = getSlateVersionPromotion({
          backend: d.input.backend,
          version: slateJson.version,
          unbuiltCurrentVersion: slate.unbuiltCurrentVersion?.version ?? null,
          builtOrUnbuiltCurrentVersion: slate.builtOrUnbuiltCurrentVersion?.version ?? null
        });

        let existingCategories = await db.slateCategory.findMany({
          where: { identifier: { in: slateJson.categories ?? [] } }
        });
        let existingCategoryIds = existingCategories.map(category => category.oid);
        let existingCategoryIdentifiers = existingCategories.map(
          category => category.identifier
        );
        let missingCategories = (slateJson.categories ?? []).filter(
          category => !existingCategoryIdentifiers.includes(category)
        );

        for (let missing of missingCategories) {
          let newCategory = await db.slateCategory.upsert({
            where: { identifier: missing },
            create: {
              ...getId('slateCategory'),
              identifier: missing,
              name: missing
            },
            update: {}
          });
          existingCategoryIds.push(newCategory.oid);
        }

        await db.slateCategoryAssignment.createMany({
          skipDuplicates: true,
          data: existingCategoryIds.map(categoryOid => ({
            slateOid: slate.oid,
            categoryOid
          }))
        });

        let storageKey = `slate/${slate.id}/${slateJson.version}/bundle.zip`;
        let bucket = env.storage.PACKAGE_BUCKET_NAME;

        await storage.putObject(bucket, storageKey, d.input.bundleBuffer, 'application/zip');

        let artifact = await db.artifact.create({
          data: {
            ...getId('artifact'),
            storageKey,
            bucket,
            size: 0,
            mimeType: 'application/zip',
            checksum: ''
          }
        });

        if (promotion.shouldSetUnbuiltCurrentVersion) {
          await db.slateVersion.updateMany({
            where: { slateOid: slate.oid, isCurrent: true },
            data: { isCurrent: false }
          });
        }

        let version = await db.slateVersion.create({
          data: {
            ...getId('slateVersion'),
            version: slateJson.version,
            slateOid: slate.oid,
            bundleArtifactOid: artifact.oid,
            createdByUserOid: d.user.oid,
            isCurrent: promotion.shouldSetUnbuiltCurrentVersion,
            backend: d.input.backend,
            npmPackageName: d.input.npmPackageName,
            slateJson
          }
        });

        await db.changeNotification.create({
          data: {
            ...getId('changeNotification'),
            type: 'slate_version_created',
            slateOid: slate.oid,
            slateId: slate.id,
            slateIdentifier: slate.identifier,
            slateFullIdentifier: slate.fullIdentifier,
            slateVersionOid: version.oid,
            slateVersionId: version.id,
            slateVersionIdentifier: version.version,
            tenantOid: d.user.tenantOid
          }
        });

        await db.slateDocument.createMany({
          data: d.input.slatePackage.docsFiles.map(file => ({
            oid: snowflake.nextId(),
            id: ID.generateIdSync('slateDocument'),
            slateVersionOid: version.oid,
            path: file.path,
            content: file.content
          }))
        });

        await db.slate.update({
          where: { oid: slate.oid },
          data: {
            unbuiltCurrentVersionOid: promotion.shouldSetUnbuiltCurrentVersion
              ? version.oid
              : undefined,
            builtOrUnbuiltCurrentVersionOid: promotion.shouldSetBuiltOrUnbuiltCurrentVersion
              ? version.oid
              : undefined,
            access: d.input.access,
            description: slateJson.description
          }
        });

        return await db.slateVersion.findFirstOrThrow({
          where: { oid: version.oid },
          include
        });
      })
    );
  }

  async getSlateVersionById(d: { id: string; slate: Slate; supportsPrebuilt?: boolean }) {
    let version = await db.slateVersion.findFirst({
      where: {
        slateOid: d.slate.oid,
        OR: [{ id: d.id }, { version: d.id }],
        ...getSlateVersionVisibilityWhere(d.supportsPrebuilt)
      },
      include
    });
    if (!version) throw new ServiceError(notFoundError('slate.version'));
    return version;
  }

  async listSlateVersions(d: { slate: Slate; supportsPrebuilt?: boolean }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateVersion.findMany({
            ...opts,
            where: {
              slateOid: d.slate.oid,
              ...getSlateVersionVisibilityWhere(d.supportsPrebuilt)
            },
            include
          })
      )
    );
  }
}

export let slateVersionService = Service.create(
  'slateVersionService',
  () => new slateVersionServiceImpl()
).build();
