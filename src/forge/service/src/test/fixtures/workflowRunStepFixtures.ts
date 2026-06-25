import type {
  PrismaClient,
  WorkflowRunStep
} from '../../../prisma/generated/client';
import { WorkflowRunStepType, WorkflowRunStepStatus } from '../../../prisma/generated/client';
import { ID, snowflake } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';

export const WorkflowRunStepFixtures = (db: PrismaClient) => {
  const defaultStep = async (data: {
    runOid: bigint;
    stepOid?: bigint | null;
    overrides?: Partial<WorkflowRunStep>;
  }): Promise<WorkflowRunStep> => {
    const oid = data.overrides?.oid ?? snowflake.nextId();
    const id = data.overrides?.id ?? ID.generateIdSync('workflowRunStep');

    const factory = defineFactory<WorkflowRunStep>(
      {
        oid,
        id,
        type: data.overrides?.type ?? WorkflowRunStepType.action,
        status: data.overrides?.status ?? WorkflowRunStepStatus.pending,
        name: data.overrides?.name ?? 'Test Run Step',
        index: data.overrides?.index ?? 0,
        runOid: data.runOid,
        stepOid: data.stepOid ?? null,
        outputStorageKey: data.overrides?.outputStorageKey ?? null,
        outputBucket: data.overrides?.outputBucket ?? null,
        createdAt: data.overrides?.createdAt ?? new Date(),
        startedAt: data.overrides?.startedAt ?? null,
        endedAt: data.overrides?.endedAt ?? null
      } as WorkflowRunStep,
      {
        persist: value => db.workflowRunStep.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const setup = async (data: {
    runOid: bigint;
    overrides?: Partial<WorkflowRunStep>;
  }): Promise<WorkflowRunStep> =>
    defaultStep({
      runOid: data.runOid,
      overrides: {
        type: WorkflowRunStepType.setup,
        name: 'Setup Build Environment',
        ...data.overrides
      }
    });

  const action = async (data: {
    runOid: bigint;
    stepOid?: bigint;
    overrides?: Partial<WorkflowRunStep>;
  }): Promise<WorkflowRunStep> =>
    defaultStep({
      runOid: data.runOid,
      stepOid: data.stepOid,
      overrides: {
        type: WorkflowRunStepType.action,
        name: 'Action Step',
        ...data.overrides
      }
    });

  const teardown = async (data: {
    runOid: bigint;
    overrides?: Partial<WorkflowRunStep>;
  }): Promise<WorkflowRunStep> =>
    defaultStep({
      runOid: data.runOid,
      overrides: {
        type: WorkflowRunStepType.teardown,
        name: 'Teardown Build Environment',
        ...data.overrides
      }
    });

  const init = async (data: {
    runOid: bigint;
    stepOid?: bigint;
    overrides?: Partial<WorkflowRunStep>;
  }): Promise<WorkflowRunStep> =>
    defaultStep({
      runOid: data.runOid,
      stepOid: data.stepOid,
      overrides: {
        type: WorkflowRunStepType.init,
        name: 'Init Step',
        ...data.overrides
      }
    });

  const cleanup = async (data: {
    runOid: bigint;
    stepOid?: bigint;
    overrides?: Partial<WorkflowRunStep>;
  }): Promise<WorkflowRunStep> =>
    defaultStep({
      runOid: data.runOid,
      stepOid: data.stepOid,
      overrides: {
        type: WorkflowRunStepType.cleanup,
        name: 'Cleanup Step',
        ...data.overrides
      }
    });

  return {
    default: defaultStep,
    setup,
    action,
    teardown,
    init,
    cleanup
  };
};
