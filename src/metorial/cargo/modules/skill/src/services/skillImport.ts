import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  fileLinkService,
  fileReferenceService,
  fileService
} from '@metorial/cargo-module-file';
import { getId } from '@metorial/cargo-config/id';
import type { ResourceAuthorization } from '@metorial/module-access';
import { type ResourceScope } from '@metorial/module-resource-tenant';
import { assertResourceActorScope } from '@metorial/module-access';
import type {
  Prisma,
  ResourceActor,
  SkillImportStatus,
  StoreParticipantPermissions
} from '@metorial/db';
import { db } from '@metorial/db';
import { detectUploadedSkillFileFormat } from '../import/archive';
import { parsePublicRepositoryUrl } from '../import/publicRepository';
import { skillImportAcquireQueue } from '../queues/import/acquire';
import { skillRepositoryService } from './skillRepository';

export let skillImportInclude = {
  creatorResourceActor: true,
  sourceFile: true,
  sourceFileLink: true,
  sourceFileReference: true,
  items: {
    include: {
      skill: {
        include: {
          store: true,
          parentSkill: { select: { id: true } },
          parentSkillTemplate: { select: { id: true } }
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  }
} satisfies Prisma.SkillImportInclude;

export type SkillImportRecord = Prisma.SkillImportGetPayload<{
  include: typeof skillImportInclude;
}>;

export type CreateSkillImportInput =
  | {
      type: 'public';
      repositoryUrl: string;
      ref?: string | null;
    }
  | {
      type: 'origin';
      repositoryId: string;
      ref?: string | null;
      path?: string | null;
    }
  | {
      type: 'file';
      fileId: string;
    };

let maxUploadedArchiveBytes = 10 * 1024 * 1024;
let maxUploadedMarkdownBytes = 3 * 1024 * 1024;

class SkillImportServiceImpl {
  async createSkillImport(
    d: ResourceScope & {
      actor?: ResourceActor;
      authorization?: ResourceAuthorization;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
      input: CreateSkillImportInput;
    }
  ) {
    assertResourceActorScope({
      resourceTenant: d.resourceTenant,
      resourceActor: d.actor
    });
    let creatorResourceActorOid = d.actor?.oid;
    if (d.input.type === 'origin' && d.actor?.consumerProfileOid) {
      throw new ServiceError(
        forbiddenError({ message: 'Consumers cannot import private repositories' })
      );
    }

    let repositoryName: string | null = null;
    let sourceFile: Awaited<ReturnType<typeof fileService.getFileById>> | undefined;
    let sourceFileFormat: 'zip' | 'markdown' | undefined;

    if (d.input.type === 'public') {
      repositoryName = parsePublicRepositoryUrl(d.input.repositoryUrl).repository;
    } else if (d.input.type === 'origin') {
      repositoryName = (
        await skillRepositoryService.getOriginRepository({
          resourceTenant: d.resourceTenant!,
          resourceGroup: d.resourceGroup,
          repoId: d.input.repositoryId
        })
      ).name;
    } else {
      if (!d.authorization) {
        throw new ServiceError(
          badRequestError({ message: 'File authorization is required for uploaded imports' })
        );
      }
      sourceFile = await fileService.getFileById({
        resourceTenant: d.resourceTenant,
        resourceGroup: d.resourceGroup,
        fileId: d.input.fileId,
        authorization: d.authorization,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions
      });
      if (sourceFile.status !== 'active') {
        throw new ServiceError(
          badRequestError({ message: 'Uploaded skill import file has been deleted' })
        );
      }
      if (sourceFile.purpose.slug !== 'generic') {
        throw new ServiceError(
          badRequestError({ message: 'Only generic uploaded files can be imported' })
        );
      }
      if (
        d.actor?.consumerProfileOid &&
        sourceFile.createdByResourceActorOid !== d.actor.oid
      ) {
        throw new ServiceError(
          forbiddenError({ message: 'Consumers can only import files they uploaded' })
        );
      }
      sourceFileFormat = detectUploadedSkillFileFormat(sourceFile) ?? undefined;
      if (!sourceFileFormat) {
        throw new ServiceError(
          badRequestError({ message: 'Uploaded skill imports must be ZIP or Markdown files' })
        );
      }
      let maxBytes =
        sourceFileFormat === 'zip' ? maxUploadedArchiveBytes : maxUploadedMarkdownBytes;
      if (sourceFile.fileSize > maxBytes) {
        throw new ServiceError(
          badRequestError({ message: 'Uploaded skill import is too large' })
        );
      }
    }

    let ids = getId('skillImport');
    let sourceFileLink = sourceFile
      ? await fileLinkService.createFileLink({
          resourceTenant: d.resourceTenant,
          resourceGroup: d.resourceGroup,
          file: sourceFile,
          input: { actor: d.actor }
        })
      : undefined;
    let sourceFileReference = sourceFileLink
      ? await fileReferenceService.upsertFileReference({
          resourceTenant: d.resourceTenant,
          resourceGroup: d.resourceGroup,
          fileLink: sourceFileLink,
          input: {
            entityType: 'skill_import',
            entityId: ids.id
          }
        })
      : undefined;
    let skillImport: SkillImportRecord;
    try {
      skillImport = await db.skillImport.create({
        data: {
          oid: ids.oid,
          id: ids.id,
          sourceType:
            d.input.type === 'public'
              ? 'public_repository'
              : d.input.type === 'origin'
                ? 'origin_repository'
                : 'uploaded_file',
          status: 'pending',
          repositoryUrl: d.input.type === 'public' ? d.input.repositoryUrl : null,
          repositoryId: d.input.type === 'origin' ? d.input.repositoryId : null,
          repositoryName,
          ref: d.input.type === 'file' ? null : (d.input.ref ?? null),
          path: d.input.type === 'origin' ? (d.input.path ?? null) : null,
          sourceFileName: sourceFile?.fileName,
          sourceFileFormat,
          sourceFileOid: sourceFile?.oid,
          sourceFileLinkOid: sourceFileLink?.oid,
          sourceFileReferenceOid: sourceFileReference?.oid,
          creatorResourceActorOid,
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid
        },
        include: skillImportInclude
      });
    } catch (error) {
      if (sourceFileReference) {
        await fileReferenceService.deleteReferenceAndLinkIfUnused({
          fileReference: sourceFileReference
        });
      }
      throw error;
    }

    await skillImportAcquireQueue.add(
      { skillImportId: skillImport.id },
      { id: `skillImport:acquire:${skillImport.id}` }
    );
    return skillImport;
  }

  async listSkillImports(
    d: ResourceScope & {
      actor?: ResourceActor;
      ids?: string[];
      statuses?: SkillImportStatus[];
    }
  ) {
    assertResourceActorScope({
      resourceTenant: d.resourceTenant,
      resourceActor: d.actor
    });
    let creatorResourceActorOid = d.actor?.oid;
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillImport.findMany({
            ...opts,
            where: {
              resourceTenantOid: d.resourceTenant.oid,
              resourceGroupOid: d.resourceGroup.oid,
              creatorResourceActorOid,
              id: d.ids?.length ? { in: d.ids } : undefined,
              status: d.statuses?.length ? { in: d.statuses } : undefined
            },
            include: skillImportInclude
          })
      )
    );
  }

  async getSkillImportById(
    d: ResourceScope & {
      actor?: ResourceActor;
      skillImportId: string;
    }
  ) {
    assertResourceActorScope({
      resourceTenant: d.resourceTenant,
      resourceActor: d.actor
    });
    let creatorResourceActorOid = d.actor?.oid;
    let skillImport = await db.skillImport.findFirst({
      where: {
        id: d.skillImportId,
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
        creatorResourceActorOid
      },
      include: skillImportInclude
    });
    if (!skillImport) throw new ServiceError(notFoundError('skillImport', d.skillImportId));
    return skillImport;
  }
}

export let skillImportService = Service.create(
  'cargoSkillImportService',
  () => new SkillImportServiceImpl()
).build();
