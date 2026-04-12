import type {
  PrismaClient,
  WorkflowVersionStep
} from '../../../prisma/generated/client';
import { WorkflowVersionStepType } from '../../../prisma/generated/client';
import { ID, snowflake } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';

export const WorkflowVersionStepFixtures = (db: PrismaClient) => {
  const defaultStep = async (data: {
    workflowVersionOid: bigint;
    overrides?: Partial<WorkflowVersionStep>;
  }): Promise<WorkflowVersionStep> => {
    const oid = data.overrides?.oid ?? snowflake.nextId();
    const id = data.overrides?.id ?? ID.generateIdSync('workflowVersionStep');

    const factory = defineFactory<WorkflowVersionStep>(
      {
        oid,
        id,
        type: data.overrides?.type ?? WorkflowVersionStepType.script,
        name: data.overrides?.name ?? 'Test Step',
        index: data.overrides?.index ?? 0,
        workflowVersionOid: data.workflowVersionOid,
        artifactToDownloadOid: data.overrides?.artifactToDownloadOid ?? null,
        artifactToDownloadPath: data.overrides?.artifactToDownloadPath ?? null,
        artifactToUploadPath: data.overrides?.artifactToUploadPath ?? null,
        artifactToUploadName: data.overrides?.artifactToUploadName ?? null,
        initScript: data.overrides?.initScript ?? [],
        actionScript: data.overrides?.actionScript ?? ['echo "Hello World"'],
        cleanupScript: data.overrides?.cleanupScript ?? [],
        createdAt: data.overrides?.createdAt ?? new Date()
      } as WorkflowVersionStep,
      {
        persist: value => db.workflowVersionStep.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const script = async (data: {
    workflowVersionOid: bigint;
    overrides?: Partial<WorkflowVersionStep>;
  }): Promise<WorkflowVersionStep> =>
    defaultStep({
      workflowVersionOid: data.workflowVersionOid,
      overrides: {
        type: WorkflowVersionStepType.script,
        name: 'Script Step',
        actionScript: ['echo "Running script"'],
        ...data.overrides
      }
    });

  const uploadArtifact = async (data: {
    workflowVersionOid: bigint;
    overrides?: Partial<WorkflowVersionStep>;
  }): Promise<WorkflowVersionStep> =>
    defaultStep({
      workflowVersionOid: data.workflowVersionOid,
      overrides: {
        type: WorkflowVersionStepType.upload_artifact,
        name: 'Upload Artifact',
        artifactToUploadPath: './output.zip',
        artifactToUploadName: 'output',
        actionScript: [],
        ...data.overrides
      }
    });

  const downloadArtifact = async (data: {
    workflowVersionOid: bigint;
    artifactOid: bigint;
    overrides?: Partial<WorkflowVersionStep>;
  }): Promise<WorkflowVersionStep> =>
    defaultStep({
      workflowVersionOid: data.workflowVersionOid,
      overrides: {
        type: WorkflowVersionStepType.download_artifact,
        name: 'Download Artifact',
        artifactToDownloadOid: data.artifactOid,
        artifactToDownloadPath: './input',
        actionScript: [],
        ...data.overrides
      }
    });

  return {
    default: defaultStep,
    script,
    uploadArtifact,
    downloadArtifact
  };
};
