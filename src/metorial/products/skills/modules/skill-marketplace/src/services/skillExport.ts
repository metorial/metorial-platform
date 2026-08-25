import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { env } from '../env';
import {
  fileLinkService,
  filePurposeService,
  fileReferenceService,
  fileService
} from '@metorial/module-file';
import { assertResourceActorScope } from '@metorial/module-access';
import { resourceActorPresentationInclude } from '@metorial/module-resource-actor';
import { createCodeBucketClient } from '@metorial/code-bucket-service-generated';
import type {
  Instance,
  Prisma,
  Project,
  ResourceActor,
  SkillDestination,
  SkillExportStatus,
  SkillExportTarget
} from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import { createHash } from 'node:crypto';
import { forceSkillDestinationSync } from '../lib/destinationSync';
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
  createdByResourceActor: {
    include: resourceActorPresentationInclude
  }
} satisfies Prisma.FileInclude;

let fileLinkInclude = {
  file: true
} satisfies Prisma.FileLinkInclude;

let fileReferenceInclude = {
  fileLink: {
    include: {
      file: true
    }
  }
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
  creatorResourceActor: {
    include: resourceActorPresentationInclude
  }
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
  private getActorOid(d: { actor?: ResourceActor }) {
    return d.actor?.oid;
  }

  private async getExportById(d: {
    project: Project;
    instance: Instance;
    skillExportId: string;
    actor?: ResourceActor;
  }) {
    let creatorResourceActorOid = this.getActorOid(d);

    let skillExport = await db.skillExport.findFirst({
      where: {
        id: d.skillExportId,
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
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

  private async resolveTarget(d: {
    project: Project;
    instance: Instance;
    input: CreateSkillExportInput;
  }): Promise<ResolvedExportTarget> {
    if (d.input.target === 'skill') {
      let managedSkillPlugin = await managedSkillPluginService.ensureManagedSkillPlugin({
        project: d.project,
        instance: d.instance,
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
          projectOid: d.project.oid,
          instanceOid: d.instance.oid,
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
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
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

  private async resolveTargetFromExport(d: {
    project: Project;
    instance: Instance;
    skillExport: SkillExportRecord;
  }) {
    let ref = d.skillExport.exportRef;

    if (d.skillExport.target === 'skill' && ref.skill) {
      return await this.resolveTarget({
        project: d.project,
        instance: d.instance,
        input: {
          target: 'skill',
          skillId: ref.skill.id
        }
      });
    }

    if (d.skillExport.target === 'plugin' && ref.skillPlugin) {
      return await this.resolveTarget({
        project: d.project,
        instance: d.instance,
        input: {
          target: 'plugin',
          skillPluginId: ref.skillPlugin.id
        }
      });
    }

    if (d.skillExport.target === 'marketplace' && ref.skillMarketplace) {
      return await this.resolveTarget({
        project: d.project,
        instance: d.instance,
        input: {
          target: 'marketplace',
          skillMarketplaceId: ref.skillMarketplace.id
        }
      });
    }

    throw new Error(`Unable to resolve target for skill export ${d.skillExport.id}`);
  }

  private async upsertExportRef(d: {
    project: Project;
    instance: Instance;
    target: ResolvedExportTarget;
  }) {
    return await db.skillExportRef.upsert({
      where: {
        instanceOid_hash: {
          instanceOid: d.instance.oid,
          hash: d.target.hash
        }
      },
      create: {
        hash: d.target.hash,
        skillConfigurationOid: d.target.skillConfigurationOid,
        skillOid: d.target.skillOid,
        managedSkillPluginOid: d.target.managedSkillPluginOid,
        skillPluginOid: d.target.skillPluginOid,
        skillMarketplaceOid: d.target.skillMarketplaceOid,
        projectOid: d.project.oid,
        instanceOid: d.instance.oid
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

  private async createExportArtifact(d: {
    project: Project;
    instance: Instance;
    skillExport: SkillExportRecord;
    target: ResolvedExportTarget;
  }) {
    let purpose = await this.ensureExportFilePurpose();
    let expiresAt = getExportExpiresAt();

    // The archive is written straight from code-bucket into object storage. It
    // never passes through this worker, so export size is bounded by
    // code-bucket's disk rather than by this process's heap.
    let { storeId, destination } = await fileService.createPendingUploadForStream();

    await codeBucketClient.exportBucketFilesAsZipToUpload({
      bucketId: d.target.destination.codeBucketId,
      prefix: '',
      uploadUrl: destination.type === 'signed_url' ? destination.url : '',
      uploadBucket: destination.type === 'internal' ? destination.bucket : '',
      uploadKey: destination.type === 'internal' ? destination.key : '',
      contentType: 'application/zip'
    });

    let file = await fileService.completePendingUploadForStream({
      project: d.project,
      instance: d.instance,
      purpose: purpose.slug,
      storeId,
      input: {
        name: d.target.fileName,
        title: d.target.fileName,
        mimeType: 'application/zip',
        expiresAt,
        authorization: { type: 'privileged' }
      }
    });

    let fileLink = await fileLinkService.createFileLink({
      project: d.project,
      instance: d.instance,
      file,
      input: {
        expiresAt
      }
    });

    let fileReference = await fileReferenceService.upsertFileReference({
      project: d.project,
      instance: d.instance,
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

  async createSkillExport(d: {
    project: Project;
    instance: Instance;
    input: CreateSkillExportInput;
    actor?: ResourceActor;
  }) {
    assertResourceActorScope({
      project: d.project,
      resourceActor: d.actor
    });
    let target = await this.resolveTarget(d);
    let creatorResourceActorOid = this.getActorOid(d);
    let exportRef = await this.upsertExportRef({
      project: d.project,
      instance: d.instance,
      target
    });
    let skillExport = await db.skillExport.create({
      data: {
        id: await ID.generateId('skillExport'),
        target: target.target,
        status: 'pending',
        exportRefOid: exportRef.oid,
        creatorResourceActorOid,
        projectOid: d.project.oid,
        instanceOid: d.instance.oid
      },
      include: skillExportInclude
    });

    await enqueueSkillExport({ skillExportId: skillExport.id });

    return skillExport;
  }

  async listSkillExports(d: {
    project: Project;
    instance: Instance;
    ids?: string[];
    targets?: SkillExportTarget[];
    statuses?: SkillExportStatus[];
    actor?: ResourceActor;
  }) {
    assertResourceActorScope({
      project: d.project,
      resourceActor: d.actor
    });
    let creatorResourceActorOid = this.getActorOid(d);

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
              projectOid: d.project.oid,
              instanceOid: d.instance.oid
            },
            include: skillExportInclude
          })
      )
    );
  }

  async getSkillExportById(d: {
    project: Project;
    instance: Instance;
    skillExportId: string;
    actor?: ResourceActor;
  }) {
    assertResourceActorScope({
      project: d.project,
      resourceActor: d.actor
    });
    return await this.getExportById(d);
  }

  async processSkillExport(d: {
    project: Project;
    instance: Instance;
    skillExportId: string;
    skillDestinationSyncId?: string;
  }) {
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
      project: d.project,
      instance: d.instance,
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
        project: d.project,
        instance: d.instance,
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
