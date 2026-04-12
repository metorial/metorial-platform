import { notFoundError, ServiceError } from '@lowerdeck/error';
import type { WorkflowVersionStep } from '../../../prisma/generated/browser';
import type { Workflow, WorkflowRun, WorkflowRunStep } from '../../../prisma/generated/client';
import { db } from '../../db';
import { encryption } from '../../encryption';
import { snowflake } from '../../id';
import { workflowArtifactService } from '../../services';
import { buildEndedQueue } from './queues';

export class BuildContext {
  private constructor(
    public readonly workflow: Workflow,
    public readonly run: WorkflowRun
  ) {}

  static async of(runId: string): Promise<BuildContext> {
    let run = await db.workflowRun.findUnique({
      where: { id: runId },
      include: { workflow: true }
    });
    if (!run) throw new ServiceError(notFoundError('workflow.run'));

    return new BuildContext(run.workflow, run);
  }

  async DANGEROUSLY_getDecryptedEnvVars() {
    let envVars: Record<string, string> = JSON.parse(
      await encryption.decrypt({
        entityId: this.run.id,
        encrypted: this.run.encryptedEnvironmentVariables
      })
    );

    return envVars;
  }

  async listArtifacts() {
    return await db.workflowArtifact.findMany({
      where: { runOid: this.run.oid }
    });
  }

  async listSteps() {
    return await db.workflowRunStep.findMany({
      where: { runOid: this.run.oid },
      include: { step: { include: { artifactToDownload: true } } }
    });
  }

  async getVersion() {
    let version = await db.workflowVersion.findUnique({
      where: { oid: this.run.versionOid }
    });
    if (!version) throw new ServiceError(notFoundError('workflow.version'));
    return version;
  }

  async getArtifactUploadInfo() {
    return await workflowArtifactService.putArtifactFromBuilderStart({
      run: this.run,
      expirationSecs: 60 * 60 * 6
    });
  }

  async completeArtifactUpload(d: {
    step: WorkflowRunStep & { step: WorkflowVersionStep | null };
    artifactData: { bucket: string; storageKey: string };
  }) {
    if (d.step.step?.type != 'upload_artifact') return;

    await workflowArtifactService.putArtifactFromBuilderFinish({
      run: this.run,
      name: d.step.step.artifactToUploadName!,
      type: 'output',
      artifactData: d.artifactData
    });
  }

  async startRun(d: { startedAt?: Date }) {
    await db.workflowRun.updateMany({
      where: { oid: this.run.oid, status: 'pending' },
      data: {
        status: 'running',
        startedAt: d.startedAt ?? new Date()
      }
    });
  }

  async startStep(d: { stepId: string; startedAt?: Date }) {
    return await db.workflowRunStep.update({
      where: {
        id: d.stepId
      },
      data: {
        status: 'running',
        startedAt: d.startedAt ?? new Date()
      }
    });
  }

  async completeStep(d: { stepId: string; status: 'succeeded' | 'failed'; endedAt?: Date }) {
    return await db.workflowRunStep.update({
      where: {
        id: d.stepId
      },
      data: {
        status: d.status,
        endedAt: d.endedAt ?? new Date()
      }
    });
  }

  async getStepById(stepId: string) {
    return await db.workflowRunStep.findFirst({
      where: { id: stepId, runOid: this.run.oid },
      include: { step: true }
    });
  }

  async storeTempOutput(d: { stepOid: bigint; message: string }) {
    await db.workflowRunOutputTemp.create({
      data: {
        oid: snowflake.nextId(),
        runOid: this.run.oid,
        stepOid: d.stepOid,
        output: d.message.trim()
      }
    });
  }

  async completeBuild(d: {
    status: 'succeeded' | 'failed';
    endedAt?: Date;
    stepArtifacts?: { stepId: string; bucket: string; storageKey: string }[];
  }) {
    await buildEndedQueue.add({
      runId: this.run.id,
      status: d.status,
      endedAt: d.endedAt ?? new Date(),
      stepArtifacts: d.stepArtifacts ?? []
    });
  }
}
