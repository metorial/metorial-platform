import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { env } from '@metorial/cargo-config';
import { getId, snowflake } from '@metorial/cargo-config/id';
import { fileLinkService, filePurposeService, fileReferenceService, fileService } from '@metorial/cargo-module-file';
import { resourceActorService } from '@metorial/module-resource-tenant';
import { type ResourceScope } from '@metorial/module-resource-tenant';
import { createCodeBucketClient } from '@metorial/code-bucket-service-generated';
import type {
  Prisma,
  SkillDestination,
  SkillExportStatus,
  SkillExportTarget
} from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { createHash } from 'node:crypto';
import { forceSkillDestinationSync } from '../internal/skillDestination';
import { enqueueSkillExport } from '../queues/export';
import { managedSkillPluginService } from './managedSkillPlugin';

let codeBucketClient = createCodeBucketClient({
  address: env.origin.CODE_BUCKET_SERVICE_URL
});

let exportFilePurpose = {
  slug: 'skill_export',
  name: 'Skill Export',
  ownerType: 'instance' as const,
  canHaveLinks: true
};

let exportExpiryMs = 7 * 24 * 60 * 60 * 1000;
let syncTimeoutMs = 30 * 60 * 1000;

let fileInclude = {
  purpose: true,
  document: {
    select: {
      id: true
    }
  },
  createdByResourceActor: true,
  resourceTenant: true,
  resourceGroup: true
} satisfies Prisma.FileInclude;

let fileLinkInclude = {
  file: true,
  resourceTenant: true,
  resourceGroup: true
} satisfies Prisma.FileLinkInclude;

let fileReferenceInclude = {
  fileLink: {
    include: {
      file: true
    }
  },
  resourceTenant: true,
  resourceGroup: true
} satisfies Prisma.FileReferenceInclude;

export let skillExportRefInclude = {
  skill: true,
  managedSkillPlugin: true,
  skillPlugin: true,
  skillMarketplace: true,
  file: {
    include: fileInclude
  },
  fileLink: {
    include: fileLinkInclude
  },
  fileReference: {
    include: fileReferenceInclude
  }
} satisfies Prisma.SkillExportRefInclude;

export let skillExportInclude = {
  exportRef: {
    include: skillExportRefInclude
  },
  file: {
    include: fileInclude
  },
  fileLink: {
    include: fileLinkInclude
  },
  fileReference: {
    include: fileReferenceInclude
  },
  creatorResourceActor: true
} satisfies Prisma.SkillExportInclude;

export type SkillExportRecord = Prisma.SkillExportGetPayload<{
  include: typeof skillExportInclude;
}>;

export type CreateSkillExportInput =
  | {
      target: 'skill';
      skillId: string;
    }
  | {
      target: 'plugin';
      skillPluginId: string;
    }
  | {
      target: 'marketplace';
      skillMarketplaceId: string;
    };

type ResolvedExportTarget = {
  target: SkillExportTarget;
  destination: SkillDestination;
  hash: string;
  skillOid?: bigint;
  managedSkillPluginOid?: bigint;
  skillPluginOid?: bigint;
  skillMarketplaceOid?: bigint;
  skillConfigurationOid?: bigint | null;
  fileName: string;
};

let getExportExpiresAt = () => new Date(Date.now() + exportExpiryMs);

let getExportHash = (d: { target: SkillExportTarget; oid: bigint }) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        version: 1,
        target: d.target,
        oid: d.oid.toString()
      })
    )
    .digest('hex');

let isReusableExportFile = (d: {
  ref: SkillExportRecord['exportRef'];
  destination: Pick<SkillDestination, 'tag'>;
}) => {
  let now = new Date();

  return (
    d.ref.fileDestinationTag === d.destination.tag &&
    !!d.ref.file &&
    !!d.ref.fileLink &&
    !!d.ref.fileReference &&
    d.ref.file.status === 'active' &&
    (!d.ref.file.expiresAt || d.ref.file.expiresAt > now) &&
    (!d.ref.fileLink.expiresAt || d.ref.fileLink.expiresAt > now)
  );
};

class SkillExportServiceImpl {
  private async getActorOid(
    d: Pick<ResourceScope, 'resourceTenant'> & { actorId?: string }
  ) {
    if (!d.actorId) return undefined;

    return (
      await resourceActorService.getActorById({
        resourceTenant: d.resourceTenant!,
        actorId: d.actorId
      })
    ).oid;
  }

  private async getExportById(
    d: ResourceScope & { skillExportId: string; actorId?: string }
  ) {
    let creatorResourceActorOid = await this.getActorOid(d);

    let skillExport = await db.skillExport.findFirst({
      where: {
        id: d.skillExportId,
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
        creatorResourceActorOid
      },
      include: skillExportInclude
    });

    if (!skillExport) throw new Error(`Skill export not found: ${d.skillExportId}`);

    return skillExport;
  }

  private async ensureExportFilePurpose() {
    return await filePurposeService.upsertFilePurpose({
      input: exportFilePurpose
    });
  }

  private async resolveTarget(
    d: ResourceScope & {
      input: CreateSkillExportInput;
    }
  ): Promise<ResolvedExportTarget> {
    if (d.input.target === 'skill') {
      let managedSkillPlugin = await managedSkillPluginService.ensureManagedSkillPlugin({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        skillId: d.input.skillId
      });

      return {
        target: 'skill',
        destination: managedSkillPlugin.skillPlugin.destination!,
        hash: getExportHash({ target: 'skill', oid: managedSkillPlugin.skillOid }),
        skillOid: managedSkillPlugin.skillOid,
        managedSkillPluginOid: managedSkillPlugin.oid,
        skillPluginOid: managedSkillPlugin.skillPluginOid,
        skillConfigurationOid: managedSkillPlugin.skillPlugin.skillConfigurationOid,
        fileName: `${managedSkillPlugin.skillPlugin.slug}.zip`
      };
    }

    if (d.input.target === 'plugin') {
      let skillPlugin = await db.skillPlugin.findFirstOrThrow({
        where: {
          id: d.input.skillPluginId,
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid,
          status: 'active'
        },
        include: {
          destination: true
        }
      });

      return {
        target: 'plugin',
        destination: skillPlugin.destination!,
        hash: getExportHash({ target: 'plugin', oid: skillPlugin.oid }),
        skillPluginOid: skillPlugin.oid,
        skillConfigurationOid: skillPlugin.skillConfigurationOid,
        fileName: `${skillPlugin.slug}.zip`
      };
    }

    let skillMarketplace = await db.skillMarketplace.findFirstOrThrow({
      where: {
        id: d.input.skillMarketplaceId,
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
        status: 'active'
      },
      include: {
        destination: true
      }
    });

    return {
      target: 'marketplace',
      destination: skillMarketplace.destination!,
      hash: getExportHash({ target: 'marketplace', oid: skillMarketplace.oid }),
      skillMarketplaceOid: skillMarketplace.oid,
      skillConfigurationOid: skillMarketplace.skillConfigurationOid,
      fileName: `${skillMarketplace.slug}.zip`
    };
  }

  private async resolveTargetFromExport(
    d: ResourceScope & {
      skillExport: SkillExportRecord;
    }
  ) {
    let ref = d.skillExport.exportRef;

    if (d.skillExport.target === 'skill' && ref.skill) {
      return await this.resolveTarget({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        input: {
          target: 'skill',
          skillId: ref.skill.id
        }
      });
    }

    if (d.skillExport.target === 'plugin' && ref.skillPlugin) {
      return await this.resolveTarget({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        input: {
          target: 'plugin',
          skillPluginId: ref.skillPlugin.id
        }
      });
    }

    if (d.skillExport.target === 'marketplace' && ref.skillMarketplace) {
      return await this.resolveTarget({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        input: {
          target: 'marketplace',
          skillMarketplaceId: ref.skillMarketplace.id
        }
      });
    }

    throw new Error(`Unable to resolve target for skill export ${d.skillExport.id}`);
  }

  private async upsertExportRef(
    d: ResourceScope & {
      target: ResolvedExportTarget;
    }
  ) {
    return await db.skillExportRef.upsert({
      where: {
        resourceTenantOid_resourceGroupOid_hash: {
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid,
          hash: d.target.hash
        }
      },
      create: {
        oid: snowflake.nextId(),
        hash: d.target.hash,
        skillConfigurationOid: d.target.skillConfigurationOid,
        skillOid: d.target.skillOid,
        managedSkillPluginOid: d.target.managedSkillPluginOid,
        skillPluginOid: d.target.skillPluginOid,
        skillMarketplaceOid: d.target.skillMarketplaceOid,
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid
      },
      update: {
        skillConfigurationOid: d.target.skillConfigurationOid,
        skillOid: d.target.skillOid,
        managedSkillPluginOid: d.target.managedSkillPluginOid,
        skillPluginOid: d.target.skillPluginOid,
        skillMarketplaceOid: d.target.skillMarketplaceOid
      },
      include: skillExportRefInclude
    });
  }

  private async reuseExportRefFile(d: {
    skillExport: SkillExportRecord;
    ref: SkillExportRecord['exportRef'];
  }) {
    let expiresAt = getExportExpiresAt();
    let file = await fileService.updateFileExpiry({
      file: d.ref.file!,
      expiresAt
    });
    let fileLink = await fileLinkService.updateFileLinkExpiry({
      fileLink: d.ref.fileLink!,
      expiresAt
    });

    return await db.skillExport.update({
      where: {
        id: d.skillExport.id
      },
      data: {
        status: 'completed',
        fileOid: file.oid,
        fileReferenceOid: d.ref.fileReference!.oid,
        fileLinkOid: fileLink.oid,
        completedAt: new Date()
      },
      include: skillExportInclude
    });
  }

  private async createExportArtifact(
    d: ResourceScope & {
      skillExport: SkillExportRecord;
      target: ResolvedExportTarget;
    }
  ) {
    let purpose = await this.ensureExportFilePurpose();
    let expiresAt = getExportExpiresAt();
    let zipStream = codeBucketClient.getBucketFilesAsZipStream({
      bucketId: d.target.destination.codeBucketId,
      prefix: ''
    });

    let file = await fileService.createUploadedFileFromByteStream({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      purpose: purpose.slug,
      content: (async function* () {
        for await (let chunk of zipStream) {
          if (chunk.content.byteLength > 0) yield chunk.content;
        }
      })(),
      input: {
        name: d.target.fileName,
        title: d.target.fileName,
        mimeType: 'application/zip',
        expiresAt
      }
    });

    let fileLink = await fileLinkService.createFileLink({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      file,
      input: {
        expiresAt
      }
    });

    let fileReference = await fileReferenceService.upsertFileReference({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      fileLink,
      input: {
        entityType: 'skill_export_ref',
        entityId: d.skillExport.exportRef.hash
      }
    });

    return await withTransaction(async db => {
      await db.skillExportRef.update({
        where: {
          oid: d.skillExport.exportRefOid
        },
        data: {
          fileOid: file.oid,
          fileReferenceOid: fileReference.oid,
          fileLinkOid: fileLink.oid,
          fileDestinationTag: d.target.destination.tag
        }
      });

      return await db.skillExport.update({
        where: {
          id: d.skillExport.id
        },
        data: {
          status: 'completed',
          fileOid: file.oid,
          fileReferenceOid: fileReference.oid,
          fileLinkOid: fileLink.oid,
          completedAt: new Date()
        },
        include: skillExportInclude
      });
    });
  }

  private async failExport(skillExportId: string) {
    await db.skillExport.updateMany({
      where: {
        id: skillExportId,
        status: 'pending'
      },
      data: {
        status: 'failed',
        completedAt: new Date()
      }
    });
  }

  async createSkillExport(
    d: ResourceScope & {
      input: CreateSkillExportInput;
      actorId?: string;
    }
  ) {
    let target = await this.resolveTarget(d);
    let creatorResourceActorOid = await this.getActorOid(d);
    let exportRef = await this.upsertExportRef({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      target
    });
    let ids = getId('skillExport');

    let skillExport = await db.skillExport.create({
      data: {
        oid: ids.oid,
        id: ids.id,
        target: target.target,
        status: 'pending',
        exportRefOid: exportRef.oid,
        creatorResourceActorOid,
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid
      },
      include: skillExportInclude
    });

    await enqueueSkillExport({ skillExportId: skillExport.id });

    return skillExport;
  }

  async listSkillExports(
    d: ResourceScope & {
      ids?: string[];
      targets?: SkillExportTarget[];
      statuses?: SkillExportStatus[];
      actorId?: string;
    }
  ) {
    let creatorResourceActorOid = await this.getActorOid(d);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillExport.findMany({
            ...opts,
            where: {
              id: d.ids?.length ? { in: d.ids } : undefined,
              target: d.targets?.length ? { in: d.targets } : undefined,
              status: d.statuses?.length ? { in: d.statuses } : undefined,
              creatorResourceActorOid,
              resourceTenantOid: d.resourceTenant.oid,
              resourceGroupOid: d.resourceGroup.oid
            },
            include: skillExportInclude
          })
      )
    );
  }

  async getSkillExportById(
    d: ResourceScope & { skillExportId: string; actorId?: string }
  ) {
    return await this.getExportById(d);
  }

  async processSkillExport(
    d: ResourceScope & {
      skillExportId: string;
      skillDestinationSyncId?: string;
    }
  ) {
    let skillExport = await this.getExportById(d);
    if (skillExport.status !== 'pending') return skillExport;

    await db.skillExport.updateMany({
      where: {
        id: skillExport.id,
        startedAt: null
      },
      data: {
        startedAt: new Date()
      }
    });

    if (Date.now() - skillExport.createdAt.getTime() > syncTimeoutMs) {
      await this.failExport(skillExport.id);
      return await this.getExportById(d);
    }

    if (d.skillDestinationSyncId) {
      let sync = await db.skillDestinationSync.findFirst({
        where: {
          id: d.skillDestinationSyncId
        }
      });

      if (sync?.status === 'pending' || sync?.status === 'processing') {
        await enqueueSkillExport(d, { delay: 5000 });
        return skillExport;
      }

      if (!sync || sync.status !== 'completed') {
        await this.failExport(skillExport.id);
        return await this.getExportById(d);
      }
    }

    let target = await this.resolveTargetFromExport({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      skillExport
    });

    let destination = await db.skillDestination.findUniqueOrThrow({
      where: {
        oid: target.destination.oid
      }
    });
    target.destination = destination;

    if (!d.skillDestinationSyncId && (destination.isDirty || destination.tag === 0)) {
      let sync = await forceSkillDestinationSync({
        destination
      });

      await enqueueSkillExport(
        {
          skillExportId: skillExport.id,
          skillDestinationSyncId: sync.id
        },
        { delay: 5000 }
      );
      return skillExport;
    }

    skillExport = await this.getExportById(d);

    if (
      isReusableExportFile({
        ref: skillExport.exportRef,
        destination
      })
    ) {
      return await this.reuseExportRefFile({
        skillExport,
        ref: skillExport.exportRef
      });
    }

    try {
      return await this.createExportArtifact({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        skillExport,
        target
      });
    } catch (error) {
      await this.failExport(skillExport.id);
      throw error;
    }
  }
}

export let skillExportService = Service.create(
  'cargoSkillExportService',
  () => new SkillExportServiceImpl()
).build();
