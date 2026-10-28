import {
  badRequestError,
  conflictError,
  forbiddenError,
  notFoundError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import semver from 'semver';
import type {
  Slate,
  SlateAccess,
  SlateVersionBackend,
  Tenant,
  User
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId, ID, snowflake } from '../id';
import { readZipEntries } from '../lib/slatePackage/archive';
import { getPrebuiltEntrypointProblem } from '../lib/slatePackage/entrypoint';
import { normalizeSlatePackage, parseSlateFullIdentifier } from '../lib/slatePackage/manifest';
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

let getSlateVersionVisibilityWhere = (supportsPrebuilt?: boolean) =>
  supportsPrebuilt === true ? {} : { backend: 'local_unbuilt' as const };

let packageLock = createLock({
  name: 'sreg/slate/pub',
  redisUrl: env.service.REDIS_URL
});

export type SlateVersionLookupStatus =
  'published' | 'not_published' | 'scope_not_found' | 'scope_forbidden' | 'slate_deleted';

type SlateAccessInput = {
  access?: SlateAccess;
  defaultAccess?: SlateAccess;
};

class slateVersionServiceImpl {
  async getPublishableScope(d: { user: User; scopeIdentifier: string }) {
    if (d.user.access !== 'read_write') {
      throw new ServiceError(
        unauthorizedError({
          message: 'User does not have permission to publish slates.'
        })
      );
    }

    let scope = await db.scope.findFirst({
      where: { identifier: d.scopeIdentifier, status: 'active' }
    });
    if (!scope) {
      throw new ServiceError(notFoundError({ entity: 'scope', id: d.scopeIdentifier }));
    }

    if (scope.tenantOid !== d.user.tenantOid) {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot publish slates to a scope outside of your tenant.'
        })
      );
    }

    return scope;
  }

  async publishSlateVersion(d: {
    user: User;
    input: SlateAccessInput & {
      identifier: {
        scopeIdentifier: string;
        slateIdentifier: string;
      } | null;
      content: Buffer;
      versionOverride?: string;
      prebuiltOnly?: boolean;
    };
  }) {
    let entries = await readZipEntries(d.input.content, {
      requireCanonicalPaths: d.input.prebuiltOnly
    });
    let slatePackage = normalizeSlatePackage({
      entries,
      identifier: d.input.identifier,
      versionOverride: d.input.versionOverride
    });

    if (d.input.prebuiltOnly) {
      let problem = slatePackage.isPrebuilt
        ? getPrebuiltEntrypointProblem(entries)
        : 'Slate package must include a built dist/ directory.';
      if (problem) throw new ServiceError(badRequestError({ message: problem }));
    }

    return this.publishNormalizedSlateVersion({
      user: d.user,
      input: {
        access: d.input.access,
        defaultAccess: d.input.defaultAccess,
        backend: slatePackage.isPrebuilt ? 'local_built' : 'local_unbuilt',
        bundleBuffer: d.input.content,
        slatePackage
      }
    });
  }

  async publishNormalizedSlateVersion(d: {
    user: User;
    input: SlateAccessInput & {
      backend: SlateVersionBackend;
      bundleBuffer: Buffer;
      slatePackage: ReturnType<typeof normalizeSlatePackage>;
    };
  }) {
    let slateJson = d.input.slatePackage.manifest;

    return packageLock.usingLock(slateJson.name, async () => {
      let scope = await this.getPublishableScope({
        user: d.user,
        scopeIdentifier: d.input.slatePackage.scopeIdentifier
      });

      let existingSlate = await db.slate.findFirst({
        where: {
          identifier: d.input.slatePackage.slateIdentifier,
          scopeOid: scope.oid,
          tenantOid: d.user.tenantOid
        },
        select: { oid: true, id: true, status: true, access: true }
      });
      if (existingSlate?.status === 'deleted') {
        throw new ServiceError(
          preconditionFailedError({
            message: 'Cannot publish to a slate that has been deleted.'
          })
        );
      }

      if (existingSlate) {
        let existingVersion = await db.slateVersion.findFirst({
          where: { slateOid: existingSlate.oid, version: slateJson.version },
          include
        });
        let existingChecksum = existingVersion?.bundleArtifact.checksum;

        if (existingVersion && existingChecksum === d.input.slatePackage.contentChecksum) {
          return existingVersion;
        }
        if (existingVersion) {
          throw new ServiceError(
            conflictError({
              message: existingChecksum
                ? `Version ${slateJson.version} of ${slateJson.name} already exists with different contents.`
                : `Version ${slateJson.version} of ${slateJson.name} already exists and predates content checksums, so it cannot be republished.`,
              hint: 'Bump the version in package.json and publish again.'
            })
          );
        }
      } else {
        // Identifiers are unique across tenants; don't reveal the owner.
        let conflictingSlate = await db.slate.findFirst({
          where: { identifier: d.input.slatePackage.slateIdentifier },
          select: { oid: true }
        });
        if (conflictingSlate) {
          throw new ServiceError(
            conflictError({
              message: `The slate identifier "${d.input.slatePackage.slateIdentifier}" is already used by another scope.`,
              hint: 'Pick a different slate name in slate.json.'
            })
          );
        }
      }

      let publicAccessPermitted = env.access.PUBLIC_ACCESS_PERMITTED !== false;
      let access =
        d.input.access ??
        existingSlate?.access ??
        (d.input.defaultAccess === 'public' && publicAccessPermitted ? 'public' : 'private');
      if (access === 'public' && !publicAccessPermitted) {
        throw new ServiceError(
          forbiddenError({
            message: 'Public access is not permitted on this tenant.',
            hint: 'Publish with access=private.'
          })
        );
      }

      let allocatedSlateIds = getId('slate');
      let allocatedArtifactIds = getId('artifact');
      let slateId = existingSlate?.id ?? allocatedSlateIds.id;
      let storageKey = `slate/${slateId}/${slateJson.version}/${allocatedArtifactIds.id}.zip`;
      let bucket = env.storage.PACKAGE_BUCKET_NAME;

      await storage.putObject(bucket, storageKey, d.input.bundleBuffer, 'application/zip');

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

      return db.$transaction(async db => {
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
              ...allocatedSlateIds,
              status: 'active',
              access,

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
            access,
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

        await db.slateCategoryAssignment.createMany({
          skipDuplicates: true,
          data: existingCategoryIds.map(categoryOid => ({
            slateOid: slate.oid,
            categoryOid
          }))
        });

        let artifact = await db.artifact.create({
          data: {
            ...allocatedArtifactIds,
            storageKey,
            bucket,
            size: d.input.bundleBuffer.length,
            mimeType: 'application/zip',
            checksum: d.input.slatePackage.contentChecksum
          }
        });

        let shouldMarkCurrent =
          promotion.shouldSetUnbuiltCurrentVersion ||
          promotion.shouldSetBuiltOrUnbuiltCurrentVersion;

        if (shouldMarkCurrent) {
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
            isCurrent: shouldMarkCurrent,
            backend: d.input.backend,
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
              : undefined
          }
        });

        return await db.slateVersion.findFirstOrThrow({
          where: { oid: version.oid },
          include
        });
      });
    });
  }

  async lookupSlateVersions(d: {
    tenant: Tenant;
    items: { identifier: string; version: string }[];
  }) {
    let items = d.items.map(item => ({
      ...item,
      parsed: parseSlateFullIdentifier(item.identifier),
      normalizedVersion: semver.valid(item.version) ?? item.version
    }));

    let [scopes, slates] = await Promise.all([
      db.scope.findMany({
        where: {
          identifier: { in: items.flatMap(item => item.parsed?.scopeIdentifier ?? []) },
          status: 'active'
        },
        select: { identifier: true, tenantOid: true }
      }),
      db.slate.findMany({
        where: {
          fullIdentifier: { in: items.flatMap(item => item.parsed?.fullIdentifier ?? []) },
          tenantOid: d.tenant.oid
        },
        select: {
          fullIdentifier: true,
          status: true,
          slateVersions: {
            where: { version: { in: items.map(item => item.normalizedVersion) } },
            select: { version: true, bundleArtifact: { select: { checksum: true } } }
          }
        }
      })
    ]);

    let scopesByIdentifier = new Map(scopes.map(scope => [scope.identifier, scope]));
    let slatesByIdentifier = new Map(slates.map(slate => [slate.fullIdentifier, slate]));

    return items.map(item => {
      let result = (status: SlateVersionLookupStatus, checksum: string | null = null) => ({
        identifier: item.identifier,
        version: item.version,
        status,
        checksum
      });

      let scope = item.parsed && scopesByIdentifier.get(item.parsed.scopeIdentifier);
      if (!item.parsed || !scope) return result('scope_not_found');
      if (scope.tenantOid !== d.tenant.oid) return result('scope_forbidden');

      let slate = slatesByIdentifier.get(item.parsed.fullIdentifier);
      if (slate?.status === 'deleted') return result('slate_deleted');

      let version = slate?.slateVersions.find(v => v.version === item.normalizedVersion);
      if (!version) return result('not_published');

      return result('published', version.bundleArtifact.checksum || null);
    });
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
