import type {
  PrismaClient,
  FunctionDeploymentStep
} from '../../../prisma/generated/client';
import {
  FunctionDeploymentStepStatus,
  FunctionDeploymentStepType
} from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';

export const FunctionDeploymentStepFixtures = (db: PrismaClient) => {
  const defaultStep = async (data: {
    functionDeploymentOid: bigint;
    overrides?: Partial<FunctionDeploymentStep>;
  }): Promise<FunctionDeploymentStep> => {
    const { oid, id } = getId('functionDeploymentStep');

    const factory = defineFactory<FunctionDeploymentStep>(
      {
        oid,
        id,
        status: data.overrides?.status ?? FunctionDeploymentStepStatus.pending,
        type: data.overrides?.type ?? FunctionDeploymentStepType.deploy,
        name: data.overrides?.name ?? 'Deploy Step',
        output: data.overrides?.output ?? '',
        functionDeploymentOid: data.functionDeploymentOid,
        startedAt: data.overrides?.startedAt ?? null,
        endedAt: data.overrides?.endedAt ?? null
      } as FunctionDeploymentStep,
      {
        persist: value => db.functionDeploymentStep.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const succeeded = async (data: {
    functionDeploymentOid: bigint;
    output?: string;
    overrides?: Partial<FunctionDeploymentStep>;
  }): Promise<FunctionDeploymentStep> => {
    const now = new Date();
    return defaultStep({
      functionDeploymentOid: data.functionDeploymentOid,
      overrides: {
        status: FunctionDeploymentStepStatus.succeeded,
        output: data.output ?? 'Step completed successfully',
        startedAt: new Date(now.getTime() - 5000),
        endedAt: now,
        ...data.overrides
      }
    });
  };

  const failed = async (data: {
    functionDeploymentOid: bigint;
    output?: string;
    overrides?: Partial<FunctionDeploymentStep>;
  }): Promise<FunctionDeploymentStep> => {
    const now = new Date();
    return defaultStep({
      functionDeploymentOid: data.functionDeploymentOid,
      overrides: {
        status: FunctionDeploymentStepStatus.failed,
        output: data.output ?? 'Step failed with error',
        startedAt: new Date(now.getTime() - 3000),
        endedAt: now,
        ...data.overrides
      }
    });
  };

  const running = async (data: {
    functionDeploymentOid: bigint;
    overrides?: Partial<FunctionDeploymentStep>;
  }): Promise<FunctionDeploymentStep> =>
    defaultStep({
      functionDeploymentOid: data.functionDeploymentOid,
      overrides: {
        status: FunctionDeploymentStepStatus.running,
        startedAt: new Date(),
        ...data.overrides
      }
    });

  return {
    default: defaultStep,
    succeeded,
    failed,
    running
  };
};
