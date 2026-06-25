import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  WorkflowArtifact,
  Workflow,
  WorkflowRun
} from '../../../prisma/generated/client';
import { WorkflowArtifactType } from '../../../prisma/generated/client';
import { ID, snowflake } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';

export const WorkflowArtifactFixtures = (db: PrismaClient) => {
  const defaultArtifact = async (data: {
    workflowOid: bigint;
    runOid: bigint;
    overrides?: Partial<WorkflowArtifact>;
  }): Promise<WorkflowArtifact> => {
    const oid = data.overrides?.oid ?? snowflake.nextId();
    const id = data.overrides?.id ?? (await ID.generateId('workflowArtifact'));

    const factory = defineFactory<WorkflowArtifact>(
      {
        oid,
        id,
        name: data.overrides?.name ?? `artifact-${randomBytes(4).toString('hex')}`,
        type: data.overrides?.type ?? WorkflowArtifactType.output,
        storageKey: data.overrides?.storageKey ?? `artifacts/${id}`,
        bucket: data.overrides?.bucket ?? 'artifacts-test',
        workflowOid: data.workflowOid,
        runOid: data.runOid,
        createdAt: data.overrides?.createdAt ?? new Date()
      } as WorkflowArtifact,
      {
        persist: value => db.workflowArtifact.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const input = async (data: {
    workflowOid: bigint;
    runOid: bigint;
    overrides?: Partial<WorkflowArtifact>;
  }): Promise<WorkflowArtifact> =>
    defaultArtifact({
      workflowOid: data.workflowOid,
      runOid: data.runOid,
      overrides: {
        type: WorkflowArtifactType.input,
        name: 'input.zip',
        ...data.overrides
      }
    });

  const output = async (data: {
    workflowOid: bigint;
    runOid: bigint;
    overrides?: Partial<WorkflowArtifact>;
  }): Promise<WorkflowArtifact> =>
    defaultArtifact({
      workflowOid: data.workflowOid,
      runOid: data.runOid,
      overrides: {
        type: WorkflowArtifactType.output,
        name: 'output.zip',
        ...data.overrides
      }
    });

  type FullArtifact = WorkflowArtifact & {
    workflow: Workflow;
    run: WorkflowRun;
  };

  const withRun = async (data: {
    run: WorkflowRun & { workflow: Workflow };
    overrides?: Partial<WorkflowArtifact>;
  }): Promise<FullArtifact> => {
    const artifact = await defaultArtifact({
      workflowOid: data.run.workflow.oid,
      runOid: data.run.oid,
      overrides: data.overrides
    });

    return db.workflowArtifact.findUniqueOrThrow({
      where: { id: artifact.id },
      include: { workflow: true, run: true }
    }) as Promise<FullArtifact>;
  };

  return {
    default: defaultArtifact,
    input,
    output,
    withRun
  };
};
