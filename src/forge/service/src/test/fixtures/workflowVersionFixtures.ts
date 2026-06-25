import type {
  PrismaClient,
  Workflow,
  WorkflowVersion,
  WorkflowVersionStep,
  Tenant,
  Provider,
  WorkflowArtifact
} from '../../../prisma/generated/client';
import { ID, snowflake } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { WorkflowFixtures } from './workflowFixtures';
import { WorkflowVersionStepFixtures } from './workflowVersionStepFixtures';
import { generatePlainId } from '@lowerdeck/id';

export const WorkflowVersionFixtures = (db: PrismaClient) => {
  const workflowFixtures = WorkflowFixtures(db);
  const stepFixtures = WorkflowVersionStepFixtures(db);

  const defaultVersion = async (data: {
    workflowOid: bigint;
    providerOid: bigint;
    overrides?: Partial<WorkflowVersion>;
  }): Promise<WorkflowVersion> => {
    const oid = data.overrides?.oid ?? snowflake.nextId();
    const id = data.overrides?.id ?? (await ID.generateId('workflowVersion'));
    const identifier = data.overrides?.identifier ?? generatePlainId(12);

    const factory = defineFactory<WorkflowVersion>(
      {
        oid,
        id,
        identifier,
        isCurrent: data.overrides?.isCurrent ?? true,
        name: data.overrides?.name ?? `Version ${identifier}`,
        workflowOid: data.workflowOid,
        providerOid: data.providerOid,
        createdAt: data.overrides?.createdAt ?? new Date()
      } as WorkflowVersion,
      {
        persist: value => db.workflowVersion.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withWorkflow = async (data?: {
    workflowOverrides?: Partial<Workflow>;
    versionOverrides?: Partial<WorkflowVersion>;
  }): Promise<
    WorkflowVersion & {
      workflow: Workflow & { tenant: Tenant; provider: Provider };
      steps: (WorkflowVersionStep & { artifactToDownload: WorkflowArtifact | null })[];
    }
  > => {
    const workflow = await workflowFixtures.withTenant({
      workflowOverrides: data?.workflowOverrides
    });

    const version = await defaultVersion({
      workflowOid: workflow.oid,
      providerOid: workflow.provider.oid,
      overrides: data?.versionOverrides
    });

    await db.workflow.update({
      where: { oid: workflow.oid },
      data: { currentVersionOid: version.oid }
    });

    return db.workflowVersion.findUniqueOrThrow({
      where: { id: version.id },
      include: {
        workflow: { include: { tenant: true, provider: true } },
        steps: { include: { artifactToDownload: true } }
      }
    }) as Promise<
      WorkflowVersion & {
        workflow: Workflow & { tenant: Tenant; provider: Provider };
        steps: (WorkflowVersionStep & { artifactToDownload: WorkflowArtifact | null })[];
      }
    >;
  };

  const complete = async (data?: {
    workflowOverrides?: Partial<Workflow>;
    versionOverrides?: Partial<WorkflowVersion>;
  }): Promise<
    WorkflowVersion & {
      workflow: Workflow & { tenant: Tenant; provider: Provider };
      steps: (WorkflowVersionStep & { artifactToDownload: WorkflowArtifact | null })[];
    }
  > => {
    const workflow = await workflowFixtures.withTenant({
      workflowOverrides: data?.workflowOverrides
    });

    const version = await defaultVersion({
      workflowOid: workflow.oid,
      providerOid: workflow.provider.oid,
      overrides: data?.versionOverrides
    });

    await stepFixtures.script({
      workflowVersionOid: version.oid,
      overrides: { index: 0 }
    });

    await db.workflow.update({
      where: { oid: workflow.oid },
      data: { currentVersionOid: version.oid }
    });

    return db.workflowVersion.findUniqueOrThrow({
      where: { id: version.id },
      include: {
        workflow: { include: { tenant: true, provider: true } },
        steps: { include: { artifactToDownload: true } }
      }
    }) as Promise<
      WorkflowVersion & {
        workflow: Workflow & { tenant: Tenant; provider: Provider };
        steps: (WorkflowVersionStep & { artifactToDownload: WorkflowArtifact | null })[];
      }
    >;
  };

  return {
    default: defaultVersion,
    withWorkflow,
    complete
  };
};
