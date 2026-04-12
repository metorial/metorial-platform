import type {
  PrismaClient,
  Workflow,
  WorkflowRun,
  WorkflowVersion,
  WorkflowRunStep,
  Tenant,
  Provider,
  WorkflowVersionStep,
  WorkflowArtifact
} from '../../../prisma/generated/client';
import { WorkflowRunStatus } from '../../../prisma/generated/client';
import { ID, snowflake } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { WorkflowVersionFixtures } from './workflowVersionFixtures';
import { WorkflowRunStepFixtures } from './workflowRunStepFixtures';
import { encryption } from '../../encryption';

export const WorkflowRunFixtures = (db: PrismaClient) => {
  const versionFixtures = WorkflowVersionFixtures(db);
  const runStepFixtures = WorkflowRunStepFixtures(db);

  const defaultRun = async (data: {
    workflowOid: bigint;
    versionOid: bigint;
    providerOid: bigint;
    overrides?: Partial<WorkflowRun>;
  }): Promise<WorkflowRun> => {
    const oid = data.overrides?.oid ?? snowflake.nextId();
    const id = data.overrides?.id ?? (await ID.generateId('workflowRun'));

    const encryptedEnv =
      data.overrides?.encryptedEnvironmentVariables ??
      (await encryption.encrypt({
        secret: JSON.stringify({}),
        entityId: id
      }));

    const factory = defineFactory<WorkflowRun>(
      {
        oid,
        id,
        status: data.overrides?.status ?? WorkflowRunStatus.pending,
        workflowOid: data.workflowOid,
        versionOid: data.versionOid,
        providerOid: data.providerOid,
        encryptedEnvironmentVariables: encryptedEnv,
        createdAt: data.overrides?.createdAt ?? new Date(),
        updatedAt: data.overrides?.updatedAt ?? new Date(),
        startedAt: data.overrides?.startedAt ?? null,
        endedAt: data.overrides?.endedAt ?? null
      } as WorkflowRun,
      {
        persist: value => db.workflowRun.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  type FullRun = WorkflowRun & {
    workflow: Workflow & { tenant: Tenant; provider: Provider };
    version: WorkflowVersion;
    steps: (WorkflowRunStep & {
      step: (WorkflowVersionStep & { artifactToDownload: WorkflowArtifact | null }) | null;
    })[];
    artifacts: WorkflowArtifact[];
  };

  const withVersion = async (data?: {
    versionOverrides?: Partial<WorkflowVersion>;
    runOverrides?: Partial<WorkflowRun>;
    withSteps?: boolean;
  }): Promise<FullRun> => {
    const version = await versionFixtures.complete({
      versionOverrides: data?.versionOverrides
    });

    const run = await defaultRun({
      workflowOid: version.workflow.oid,
      versionOid: version.oid,
      providerOid: version.workflow.provider.oid,
      overrides: data?.runOverrides
    });

    if (data?.withSteps !== false) {
      await runStepFixtures.setup({
        runOid: run.oid,
        overrides: { index: 0 }
      });

      let index = 1;
      for (const versionStep of version.steps) {
        await runStepFixtures.action({
          runOid: run.oid,
          stepOid: versionStep.oid,
          overrides: { index: index++, name: `Step: ${versionStep.name}` }
        });
      }

      await runStepFixtures.teardown({
        runOid: run.oid,
        overrides: { index: index }
      });
    }

    return db.workflowRun.findUniqueOrThrow({
      where: { id: run.id },
      include: {
        workflow: { include: { tenant: true, provider: true } },
        version: true,
        steps: { include: { step: { include: { artifactToDownload: true } } } },
        artifacts: true
      }
    }) as Promise<FullRun>;
  };

  const pending = async (
    data?: Parameters<typeof withVersion>[0]
  ): Promise<FullRun> =>
    withVersion({
      ...data,
      runOverrides: {
        status: WorkflowRunStatus.pending,
        ...data?.runOverrides
      }
    });

  const succeeded = async (
    data?: Parameters<typeof withVersion>[0]
  ): Promise<FullRun> =>
    withVersion({
      ...data,
      runOverrides: {
        status: WorkflowRunStatus.succeeded,
        startedAt: new Date(),
        endedAt: new Date(),
        ...data?.runOverrides
      }
    });

  const failed = async (
    data?: Parameters<typeof withVersion>[0]
  ): Promise<FullRun> =>
    withVersion({
      ...data,
      runOverrides: {
        status: WorkflowRunStatus.failed,
        startedAt: new Date(),
        endedAt: new Date(),
        ...data?.runOverrides
      }
    });

  return {
    default: defaultRun,
    withVersion,
    pending,
    succeeded,
    failed
  };
};
