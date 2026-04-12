import { notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Workflow } from '../../prisma/generated/client';
import { db } from '../db';
import { ID, snowflake } from '../id';
import { providerService } from './provider';

export type WorkflowVersionSteps =
  | {
      name: string;
      type: 'script';
      initScript?: string[];
      actionScript: string[];
      cleanupScript?: string[];
    }
  | {
      name: string;
      type: 'download_artifact';
      artifactId: string;
      artifactDestinationPath: string;
    }
  | {
      name: string;
      type: 'upload_artifact';
      artifactSourcePath: string;
      artifactName: string;
    };

let include = { steps: { include: { artifactToDownload: true } }, workflow: true };

class workflowVersionServiceImpl {
  async createWorkflowVersion(d: {
    workflow: Workflow;
    input: {
      name: string;
      steps: WorkflowVersionSteps[];
    };
  }) {
    let identifier = generatePlainId(12);

    return await db.$transaction(async db => {
      let version = await db.workflowVersion.create({
        data: {
          oid: snowflake.nextId(),
          id: await ID.generateId('workflowVersion'),
          identifier,

          isCurrent: true,

          name: d.input.name,

          workflowOid: d.workflow.oid,
          providerOid: (await providerService.getDefaultProvider()).oid,

          steps: {
            create: await Promise.all(
              d.input.steps.map(async (s, index) => {
                let artifact =
                  s.type === 'download_artifact'
                    ? await (async () => {
                        let artifact = await db.workflowArtifact.findFirst({
                          where: {
                            id: s.artifactId,
                            workflowOid: d.workflow.oid
                          }
                        });
                        if (!artifact)
                          throw new ServiceError(notFoundError('workflow.artifact'));

                        return artifact;
                      })()
                    : null;

                return {
                  oid: snowflake.nextId(),
                  id: ID.generateIdSync('workflowVersionStep'),

                  name: s.name,
                  type: s.type,

                  index,

                  artifactToDownloadOid: artifact?.oid,
                  artifactToDownloadPath:
                    s.type === 'download_artifact' ? s.artifactDestinationPath : undefined,

                  artifactToUploadPath:
                    s.type === 'upload_artifact' ? s.artifactSourcePath : undefined,
                  artifactToUploadName:
                    s.type === 'upload_artifact' ? s.artifactName : undefined,

                  actionScript: 'actionScript' in s ? s.actionScript : [],
                  initScript: 'initScript' in s && s.initScript ? s.initScript : [],
                  cleanupScript: 'cleanupScript' in s && s.cleanupScript ? s.cleanupScript : []
                };
              })
            )
          }
        },
        include
      });

      await db.workflow.updateMany({
        where: { oid: d.workflow.oid },
        data: { currentVersionOid: version.oid }
      });

      await db.workflowVersion.updateMany({
        where: {
          workflowOid: d.workflow.oid,
          oid: { not: version.oid }
        },
        data: { isCurrent: false }
      });

      return version;
    });
  }

  async getWorkflowVersionById(d: { id: string; workflow: Workflow }) {
    let workflowVersion = await db.workflowVersion.findFirst({
      where: {
        OR: [{ id: d.id }, { identifier: d.id }],
        workflowOid: d.workflow.oid
      },
      include
    });
    if (!workflowVersion) throw new ServiceError(notFoundError('workflow.version'));
    return workflowVersion;
  }

  async listWorkflowVersions(d: { workflow: Workflow }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.workflowVersion.findMany({
            ...opts,
            where: {
              workflowOid: d.workflow.oid
            },
            include
          })
      )
    );
  }
}

export let workflowVersionService = Service.create(
  'workflowVersionService',
  () => new workflowVersionServiceImpl()
).build();
