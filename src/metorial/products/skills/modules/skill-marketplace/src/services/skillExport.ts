import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { env } from '../env';
import {
  deleteCargoObjectIfUnreferenced,
  fileLinkService,
  filePurposeService,
  fileReferenceService,
  fileService,
  getCargoFilesBucketName,
  isObjectMissingError
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
  SkillDestinationManifest,
  SkillExportStatus,
  SkillExportTarget
} from '@metorial/db';
import { createSystemAuditScope } from '@metorial/audit-scope';
import { db, ID, withTransaction } from '@metorial/db';
import { getSkillDestinationCodeBucketId } from '@metorial/skills-scm-utils';
import { getStorage } from '@metorial/module-file';
import { createHash } from 'node:crypto';
import { forceSkillDestinationSync } from '../lib/destinationSync';
import {
  createSkillExportZipJob,
  disposeSkillExportZipSpec,
  findMissingSkillExportSources,
  getObjectStorageErrorStatus,
  getSkillExportArchiveKey,
  getSkillExportZipJobId,
  getSkillExportZipJobOutcome,
  isSkillExportRecoveryJobId,
  isZipJobConnectionError,
  prepareSkillExportZipSpec,
  skillExportZipJobMaxAttempts,
  skillExportZipJobPollDelayMs,
  skillExportZipJobTimeoutMs,
  skillExportZipJobWaitSeconds,
  type SkillExportZipJob
} from '../lib/skillExportArchive';
import { enqueueSkillExport, type SkillExportJobData } from '../queues/export';
import { recoverMissingManifestSources } from '../queues/sync/manifest/recovery';
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
let syncWaitMs = 5000;
let smallDestinationSyncWaitMs = 1000;
let smallDestinationFastSyncWaits = 10;
let smallDestinationMaxFiles = 1000;

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

type ManifestExportContext = {
  project: Project;
  instance: Instance;
  skillExport: SkillExportRecord;
  manifest: SkillDestinationManifest;
  zipStartedAt: number;
};

let getExportFileName = (ref: SkillExportRecord['exportRef']) =>
  `${(ref.skillMarketplace ?? ref.skillPlugin)?.slug ?? 'export'}.zip`;

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
  destination: Pick<SkillDestination, 'tag' | 'storageMode'>;
  manifest?: Pick<SkillDestinationManifest, 'oid'>;
}) => {
  let now = new Date();
  let isSameContent =
    d.destination.storageMode === 'manifest'
      ? !!d.manifest && d.ref.fileManifestOid === d.manifest.oid
      : d.ref.fileDestinationTag === d.destination.tag;

  return (
    isSameContent &&
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

    if (!skillExport) throw new ServiceError(notFoundError('skill.export', d.skillExportId));

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
      let skillPlugin = await db.skillPlugin.findFirst({
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
      if (!skillPlugin) {
        throw new ServiceError(notFoundError('skill.plugin', d.input.skillPluginId));
      }

      return {
        target: 'plugin',
        destination: skillPlugin.destination!,
        hash: getExportHash({ target: 'plugin', oid: skillPlugin.oid }),
        skillPluginOid: skillPlugin.oid,
        skillConfigurationOid: skillPlugin.skillConfigurationOid,
        fileName: `${skillPlugin.slug}.zip`
      };
    }

    let skillMarketplace = await db.skillMarketplace.findFirst({
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
    if (!skillMarketplace) {
      throw new ServiceError(notFoundError('skill.marketplace', d.input.skillMarketplaceId));
    }

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

  private async createExportFile(d: {
    project: Project;
    instance: Instance;
    skillExport: SkillExportRecord;
    storeId: string;
    fileName: string;
  }) {
    let purpose = await this.ensureExportFilePurpose();
    let expiresAt = getExportExpiresAt();

    let file = await fileService.completePendingUploadForStream({
      project: d.project,
      instance: d.instance,
      auditScope: createSystemAuditScope({
        organization: { oid: d.instance.organizationOid },
        instance: d.instance,
        job: 'skill-export',
        metadata: { skillExportId: d.skillExport.id }
      }),
      purpose: purpose.slug,
      storeId: d.storeId,
      skipContentHashes: true,
      input: {
        name: d.fileName,
        title: d.fileName,
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

    return { file, fileLink, fileReference };
  }

  private async createExportArtifact(d: {
    project: Project;
    instance: Instance;
    skillExport: SkillExportRecord;
    target: ResolvedExportTarget;
  }) {
    let { storeId, destination } = await fileService.createPendingUploadForStream();

    await codeBucketClient.exportBucketFilesAsZipToUpload({
      bucketId: getSkillDestinationCodeBucketId(d.target.destination),
      prefix: '',
      uploadUrl: destination.type === 'signed_url' ? destination.url : '',
      uploadHeaders: destination.type === 'signed_url' ? destination.headers : {},
      uploadBucket: destination.type === 'internal' ? destination.bucket : '',
      uploadKey: destination.type === 'internal' ? destination.key : '',
      contentType: 'application/zip'
    });

    let { file, fileLink, fileReference } = await this.createExportFile({
      ...d,
      storeId,
      fileName: d.target.fileName
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

  private async findExportDestination(skillExport: SkillExportRecord) {
    let destinationOid =
      skillExport.exportRef.skillMarketplace?.destinationOid ??
      skillExport.exportRef.skillPlugin?.destinationOid;
    if (!destinationOid) return null;

    return await db.skillDestination.findUnique({
      where: {
        oid: destinationOid
      }
    });
  }

  private async deleteUnreferencedExportArchive(skillExport: SkillExportRecord) {
    if (!skillExport.zipJobId) return;

    await deleteCargoObjectIfUnreferenced({
      bucket: getCargoFilesBucketName(),
      key: getSkillExportArchiveKey(skillExport.id)
    }).catch(error => {
      if (isObjectMissingError(error)) return;
      console.warn(
        `Could not delete the archive of failed skill export ${skillExport.id}`,
        error
      );
    });
  }

  private async enqueueSyncWait(d: {
    skillExportId: string;
    skillDestinationSyncId: string;
    destinationOid: bigint;
    syncWaits?: number;
  }) {
    let syncWaits = d.syncWaits ?? 0;
    let isSmall =
      syncWaits < smallDestinationFastSyncWaits &&
      (await db.skillDestinationFile.count({
        where: { destinationOid: d.destinationOid },
        take: smallDestinationMaxFiles + 1
      })) <= smallDestinationMaxFiles;

    await enqueueSkillExport(
      {
        skillExportId: d.skillExportId,
        skillDestinationSyncId: d.skillDestinationSyncId,
        syncWaits: syncWaits + 1
      },
      { delay: isSmall ? smallDestinationSyncWaitMs : syncWaitMs }
    );
  }

  private async failManifestExport(d: { skillExport: SkillExportRecord; reason: string }) {
    console.warn(`Skill export ${d.skillExport.id} failed: ${d.reason}`);

    await this.failExport(d.skillExport.id);
    await this.deleteUnreferencedExportArchive(d.skillExport);
    return await db.skillExport.findUniqueOrThrow({
      where: {
        id: d.skillExport.id
      },
      include: skillExportInclude
    });
  }

  private async processManifestExport(d: {
    project: Project;
    instance: Instance;
    skillExport: SkillExportRecord;
    destination: SkillDestination;
    job: SkillExportJobData;
  }) {
    if (d.job.manifestId) {
      return await this.pollManifestExportZipJob({
        ...d,
        manifestId: d.job.manifestId
      });
    }

    let timeoutMs = d.skillExport.zipJobId
      ? syncTimeoutMs + skillExportZipJobTimeoutMs
      : syncTimeoutMs;
    if (Date.now() - d.skillExport.createdAt.getTime() > timeoutMs) {
      return await this.failManifestExport({
        skillExport: d.skillExport,
        reason: 'Timed out waiting for the destination content'
      });
    }

    let manifest: SkillDestinationManifest | null = null;

    if (d.job.skillDestinationSyncId) {
      let sync = await db.skillDestinationSync.findFirst({
        where: {
          id: d.job.skillDestinationSyncId
        },
        include: {
          manifest: true
        }
      });

      if (sync?.manifest) {
        manifest = sync.manifest;
      } else if (sync?.status === 'pending' || sync?.status === 'processing') {
        await this.enqueueSyncWait({
          skillExportId: d.skillExport.id,
          skillDestinationSyncId: sync.id,
          destinationOid: d.destination.oid,
          syncWaits: d.job.syncWaits
        });
        return d.skillExport;
      } else if (sync?.status === 'canceled') {
        let newerSync = await db.skillDestinationSync.findFirst({
          where: {
            destinationOid: sync.destinationOid,
            oid: { gt: sync.oid }
          },
          orderBy: { oid: 'desc' }
        });
        if (!newerSync) {
          return await this.failManifestExport({
            skillExport: d.skillExport,
            reason: `Sync ${sync.id} was canceled`
          });
        }

        await this.enqueueSyncWait({
          skillExportId: d.skillExport.id,
          skillDestinationSyncId: newerSync.id,
          destinationOid: d.destination.oid,
          syncWaits: d.job.syncWaits
        });
        return d.skillExport;
      } else {
        return await this.failManifestExport({
          skillExport: d.skillExport,
          reason: sync
            ? `Sync ${sync.id} ended as ${sync.status} without content`
            : `Sync ${d.job.skillDestinationSyncId} not found`
        });
      }
    }

    await this.resolveTargetFromExport({
      project: d.project,
      instance: d.instance,
      skillExport: d.skillExport
    });

    let destination = await db.skillDestination.findUniqueOrThrow({
      where: {
        oid: d.destination.oid
      },
      include: {
        currentManifest: true
      }
    });

    if (!manifest) {
      if (destination.isDirty || !destination.currentManifest) {
        let sync = await forceSkillDestinationSync({
          destination
        });

        await this.enqueueSyncWait({
          skillExportId: d.skillExport.id,
          skillDestinationSyncId: sync.id,
          destinationOid: destination.oid,
          syncWaits: d.job.syncWaits
        });
        return d.skillExport;
      }

      manifest = destination.currentManifest;
    }

    let skillExport = await this.getExportById({ ...d, skillExportId: d.skillExport.id });

    if (
      isReusableExportFile({
        ref: skillExport.exportRef,
        destination,
        manifest
      })
    ) {
      return await this.reuseExportRefFile({
        skillExport,
        ref: skillExport.exportRef
      });
    }

    skillExport = await db.skillExport.update({
      where: {
        id: skillExport.id
      },
      data: {
        zipJobId:
          skillExport.zipJobId ?? getSkillExportZipJobId({ skillExportId: skillExport.id }),
        zipJobAttempts: Math.max(skillExport.zipJobAttempts, 1)
      },
      include: skillExportInclude
    });

    return await this.submitManifestExportZipJob({
      project: d.project,
      instance: d.instance,
      skillExport,
      manifest,
      zipStartedAt: Date.now()
    });
  }

  private async pollManifestExportZipJob(d: {
    project: Project;
    instance: Instance;
    skillExport: SkillExportRecord;
    manifestId: string;
    job: SkillExportJobData;
  }) {
    let manifest = await db.skillDestinationManifest.findUnique({
      where: {
        id: d.manifestId
      }
    });
    if (!manifest || !d.skillExport.zipJobId) {
      return await this.failManifestExport({
        skillExport: d.skillExport,
        reason: `Manifest ${d.manifestId} or the zip job is gone`
      });
    }

    let context: ManifestExportContext = {
      project: d.project,
      instance: d.instance,
      skillExport: d.skillExport,
      manifest,
      zipStartedAt: d.job.zipStartedAt ?? Date.now()
    };

    if (Date.now() - context.zipStartedAt > skillExportZipJobTimeoutMs) {
      await getStorage()
        .cancelZipJob(d.skillExport.zipJobId)
        .catch(() => {});
      return await this.failManifestExport({
        skillExport: d.skillExport,
        reason: 'Timed out waiting for the zip job'
      });
    }

    let job: SkillExportZipJob;
    try {
      job = await getStorage().getZipJob(d.skillExport.zipJobId);
    } catch (error) {
      if (getObjectStorageErrorStatus(error) === 404) {
        return await this.resubmitManifestExportZipJob(context);
      }

      return await this.handleZipJobRequestError(context, error);
    }

    return await this.applyManifestExportZipJob(context, job);
  }

  private async submitManifestExportZipJob(
    d: ManifestExportContext,
    opts: { isResubmission?: boolean } = {}
  ): Promise<SkillExportRecord> {
    let spec = await prepareSkillExportZipSpec({
      skillExportId: d.skillExport.id,
      manifest: d.manifest
    });

    let job: SkillExportZipJob;
    try {
      job = await createSkillExportZipJob(d.skillExport.zipJobId!, spec, {
        waitSeconds: skillExportZipJobWaitSeconds
      });
    } catch (error) {
      return await this.handleZipJobRequestError(d, error);
    } finally {
      await disposeSkillExportZipSpec(spec);
    }

    return await this.applyManifestExportZipJob(d, job, opts);
  }

  private async resubmitManifestExportZipJob(
    d: ManifestExportContext
  ): Promise<SkillExportRecord> {
    if (d.skillExport.zipJobAttempts >= skillExportZipJobMaxAttempts) {
      return await this.failManifestExport({
        skillExport: d.skillExport,
        reason: `Zip job failed after ${d.skillExport.zipJobAttempts} attempts`
      });
    }

    let skillExport = await db.skillExport.update({
      where: {
        id: d.skillExport.id
      },
      data: {
        zipJobAttempts: { increment: 1 }
      },
      include: skillExportInclude
    });

    return await this.submitManifestExportZipJob(
      { ...d, skillExport },
      { isResubmission: true }
    );
  }

  private async enqueueManifestExportZipJobPoll(d: ManifestExportContext) {
    await enqueueSkillExport(
      {
        skillExportId: d.skillExport.id,
        manifestId: d.manifest.id,
        zipStartedAt: d.zipStartedAt
      },
      { delay: skillExportZipJobPollDelayMs }
    );
    return d.skillExport;
  }

  private async handleZipJobRequestError(d: ManifestExportContext, error: unknown) {
    let status = getObjectStorageErrorStatus(error);
    let isTransient =
      status === undefined ? isZipJobConnectionError(error) : status === 429 || status >= 500;

    if (isTransient) return await this.enqueueManifestExportZipJobPoll(d);

    await this.failExport(d.skillExport.id);
    await this.deleteUnreferencedExportArchive(d.skillExport);
    throw error;
  }

  private async applyManifestExportZipJob(
    d: ManifestExportContext,
    job: SkillExportZipJob,
    opts: { isResubmission?: boolean } = {}
  ): Promise<SkillExportRecord> {
    let outcome = getSkillExportZipJobOutcome({
      job,
      attempts: d.skillExport.zipJobAttempts,
      canRecover: !isSkillExportRecoveryJobId(d.skillExport.zipJobId!)
    });

    if (outcome.type === 'wait') return await this.enqueueManifestExportZipJobPoll(d);

    if (outcome.type === 'completed') {
      return await this.completeManifestExport({ ...d, result: outcome.result });
    }

    if (outcome.type === 'resubmit') {
      if (opts.isResubmission) return await this.enqueueManifestExportZipJobPoll(d);
      return await this.resubmitManifestExportZipJob(d);
    }

    if (outcome.type === 'recover') {
      return await this.recoverManifestExportSources(d, {
        message: job.error?.message ?? ''
      });
    }

    return await this.failManifestExport({
      skillExport: d.skillExport,
      reason: outcome.reason
    });
  }

  private async recoverManifestExportSources(
    d: ManifestExportContext,
    failure: { message: string }
  ) {
    let sourceKeys = await findMissingSkillExportSources({
      message: failure.message,
      manifest: d.manifest
    });
    let manifestSync = await db.skillDestinationSync.findFirst({
      where: { manifestOid: d.manifest.oid },
      orderBy: { oid: 'desc' },
      select: { oid: true }
    });

    let recovery = await recoverMissingManifestSources({
      destinationOid: d.manifest.destinationOid,
      afterSyncOid: manifestSync?.oid,
      keys: sourceKeys.length ? sourceKeys : undefined
    });
    if (recovery.status === 'limit_reached') {
      return await this.failManifestExport({
        skillExport: d.skillExport,
        reason: `source_not_found after repeated rebuilds: ${failure.message}`
      });
    }
    let { sync } = recovery;

    await db.skillExport.update({
      where: {
        id: d.skillExport.id
      },
      data: {
        zipJobId: getSkillExportZipJobId({
          skillExportId: d.skillExport.id,
          isRecoveryRetry: true
        }),
        zipJobAttempts: 0
      }
    });

    await this.enqueueSyncWait({
      skillExportId: d.skillExport.id,
      skillDestinationSyncId: sync.id,
      destinationOid: d.manifest.destinationOid
    });
    return d.skillExport;
  }

  private async completeManifestExport(
    d: ManifestExportContext & { result: NonNullable<SkillExportZipJob['result']> }
  ) {
    let { file, fileLink, fileReference } = await this.createExportFile({
      project: d.project,
      instance: d.instance,
      skillExport: d.skillExport,
      storeId: getSkillExportArchiveKey(d.skillExport.id),
      fileName: getExportFileName(d.skillExport.exportRef)
    }).catch(async error => {
      await this.failExport(d.skillExport.id);
      await this.deleteUnreferencedExportArchive(d.skillExport);
      throw error;
    });

    let renamedEntries = d.result.renamedEntries.map(entry => ({
      path: entry.path,
      archivePath: entry.archivePath
    }));
    if (renamedEntries.length) {
      console.info(
        JSON.stringify({
          event: 'cargo_skill_export_renamed_entries',
          level: 'info',
          skillExportId: d.skillExport.id,
          count: renamedEntries.length,
          sample: renamedEntries.slice(0, 5)
        })
      );
    }

    await withTransaction(async db => {
      let completed = await db.skillExport.updateMany({
        where: {
          id: d.skillExport.id,
          status: 'pending'
        },
        data: {
          status: 'completed',
          fileOid: file.oid,
          fileReferenceOid: fileReference.oid,
          fileLinkOid: fileLink.oid,
          renamedEntries: renamedEntries.length ? renamedEntries : undefined,
          completedAt: new Date()
        }
      });
      if (!completed.count) return;

      await db.skillExportRef.update({
        where: {
          oid: d.skillExport.exportRefOid
        },
        data: {
          fileOid: file.oid,
          fileReferenceOid: fileReference.oid,
          fileLinkOid: fileLink.oid,
          fileDestinationTag: null,
          fileManifestOid: d.manifest.oid
        }
      });
    });

    return await db.skillExport.findUniqueOrThrow({
      where: {
        id: d.skillExport.id
      },
      include: skillExportInclude
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

  async processSkillExport(
    d: {
      project: Project;
      instance: Instance;
    } & SkillExportJobData
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

    let exportDestination = await this.findExportDestination(skillExport);
    if (exportDestination?.storageMode === 'manifest') {
      return await this.processManifestExport({
        project: d.project,
        instance: d.instance,
        skillExport,
        destination: exportDestination,
        job: d
      });
    }

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
        await this.enqueueSyncWait({
          skillExportId: skillExport.id,
          skillDestinationSyncId: sync.id,
          destinationOid: sync.destinationOid,
          syncWaits: d.syncWaits
        });
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

      await this.enqueueSyncWait({
        skillExportId: skillExport.id,
        skillDestinationSyncId: sync.id,
        destinationOid: destination.oid,
        syncWaits: d.syncWaits
      });
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
