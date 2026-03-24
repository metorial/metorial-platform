import {
  badRequestError,
  forbiddenError,
  notFoundError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError,
  validationError
} from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { type ValidationTypeValue, v } from '@lowerdeck/validation';
import semver from 'semver';
import unzipper from 'unzipper';
import type { Slate, SlateAccess, User } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId, ID, snowflake } from '../id';
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

let packageLock = createLock({
  name: 'sreg/slate/pub',
  redisUrl: env.service.REDIS_URL
});

let slateJsonValidation = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  version: v.string({
    modifiers: [
      v => {
        if (!semver.valid(v))
          return [
            { code: 'invalid_semver', message: 'Version is not a valid semver string.' }
          ];

        return [];
      }
    ]
  }),
  categories: v.optional(v.array(v.string())),
  skills: v.optional(v.array(v.string())),
  logoUrl: v.optional(v.string())
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
    let directory = await unzipper.Open.buffer(Buffer.from(d.input.contentBase64, 'base64'));
    let docsFiles: {
      path: string;
      content: string;
    }[] = [];
    let slateJson: ValidationTypeValue<typeof slateJsonValidation> | null = null;

    let fullIdentifier = '';

    for (let entry of directory.files) {
      if (entry.type !== 'File') continue;

      if (entry.path.toLowerCase() === 'slate.json') {
        let content = (await entry.buffer()).toString('utf-8');

        try {
          slateJson = JSON.parse(content) as ValidationTypeValue<typeof slateJsonValidation>;
        } catch {
          throw new ServiceError(
            badRequestError({
              message: 'slate.json is not valid JSON.'
            })
          );
        }

        let valRes = slateJsonValidation.validate(slateJson);
        if (!valRes.success) {
          throw new ServiceError(
            validationError({
              message: 'slate.json is invalid.',
              entity: 'slate.json',
              errors: valRes.errors
            })
          );
        }

        fullIdentifier = slateJson.name.replace('@', '');

        if (
          d.input.identifier &&
          slateJson.name !==
            `@${d.input.identifier.scopeIdentifier}/${d.input.identifier.slateIdentifier}`
        ) {
          throw new ServiceError(
            badRequestError({
              message: `slate.json name "${slateJson.name}" does not match scope/slate identifier.`
            })
          );
        }
      }

      if (
        (!entry.path.startsWith(`docs/`) || !entry.path.endsWith('.md')) &&
        entry.path.toLowerCase() !== 'readme.md'
      )
        continue;

      docsFiles.push({
        path: entry.path,
        content: (await entry.buffer()).toString('utf-8')
      });
    }

    if (!slateJson) {
      throw new ServiceError(
        badRequestError({
          message: 'slate.json is required in the root of the project archive.'
        })
      );
    }

    let fullParts = fullIdentifier.split('/');
    if (fullParts.length !== 2) {
      throw new ServiceError(
        badRequestError({
          message: 'slate.json name must be in the format @scope/identifier.'
        })
      );
    }

    let scopeIdentifier = fullParts[0]!;
    let slateIdentifier = fullParts[1]!;

    return packageLock.usingLock(slateJson.name, () =>
      db.$transaction(async db => {
        let valid = semver.valid(d.input.versionOverride ?? slateJson.version);
        if (!valid) {
          throw new ServiceError(
            badRequestError({
              message: `Version ${slateJson.version} is not a valid semver version.`
            })
          );
        }
        slateJson.version = valid;

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
            identifier: scopeIdentifier,
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
            identifier: slateIdentifier,
            scopeOid: scope.oid,
            tenantOid: d.user.tenantOid
          },
          include: { currentVersion: true }
        });
        if (slate?.status === 'deleted') {
          throw new ServiceError(
            preconditionFailedError({
              message: 'Cannot publish to a slate that has been deleted.'
            })
          );
        }

        if (slate?.currentVersion) {
          if (!semver.gt(slateJson.version, slate.currentVersion.version)) {
            throw new ServiceError(
              preconditionFailedError({
                message: `New version ${slateJson.version} must be greater than existing version ${slate.currentVersion.version}.`
              })
            );
          }
        }

        if (!slate) {
          slate = await db.slate.create({
            data: {
              ...getId('slate'),
              status: 'active',
              access: d.input.access,

              identifier: slateIdentifier,
              fullIdentifier: fullIdentifier,
              name: slateIdentifier,

              scopeOid: scope.oid,
              tenantOid: d.user.tenantOid,
              createdByUserOid: d.user.oid
            },
            include: { currentVersion: true }
          });
        }

        slate = await db.slate.update({
          where: { oid: slate.oid },
          data: {
            access: d.input.access,
            name: slateIdentifier,
            description: slateJson.description,
            skills: slateJson.skills,
            logoUrl: slateJson.logoUrl
          },
          include: { currentVersion: true }
        });

        let existingCategories = await db.slateCategory.findMany({
          where: { identifier: { in: slateJson.categories ?? [] } }
        });
        let existingCategoryIds = existingCategories.map(c => c.oid);
        let existingCategoryIdentifiers = existingCategories.map(c => c.identifier);
        let missingCategories = (slateJson.categories ?? []).filter(
          c => !existingCategoryIdentifiers.includes(c)
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

        let buffer = Buffer.from(d.input.contentBase64, 'base64');

        await storage.putObject(bucket, storageKey, buffer, 'application/zip');

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

        await db.slateVersion.updateMany({
          where: { slateOid: slate.oid, isCurrent: true },
          data: { isCurrent: false }
        });

        let version = await db.slateVersion.create({
          data: {
            ...getId('slateVersion'),
            version: slateJson.version,
            slateOid: slate.oid,
            bundleArtifactOid: artifact.oid,
            createdByUserOid: d.user.oid,
            isCurrent: true,
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
          data: docsFiles.map(f => ({
            oid: snowflake.nextId(),
            id: ID.generateIdSync('slateDocument'),
            slateVersionOid: version.oid,
            path: f.path,
            content: f.content
          }))
        });

        await db.slate.update({
          where: { oid: slate.oid },
          data: {
            currentVersionOid: version.oid,
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

  async getSlateVersionById(d: { id: string; slate: Slate }) {
    let version = await db.slateVersion.findFirst({
      where: {
        slateOid: d.slate.oid,
        OR: [{ id: d.id }, { version: d.id }]
      },
      include
    });
    if (!version) throw new ServiceError(notFoundError('slate.version'));
    return version;
  }

  async listSlateVersions(d: { slate: Slate }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateVersion.findMany({
            ...opts,
            where: {
              slateOid: d.slate.oid
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
