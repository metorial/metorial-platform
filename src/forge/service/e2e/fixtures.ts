import { uniqueId } from '@lowerdeck/testing-tools';
import type { WorkflowRunStatus } from '../prisma/generated/client';
import { db } from '../src/db';
import { encryption } from '../src/encryption';
import { ID, snowflake } from '../src/id';
import { forge } from './client';

export let createTenant = async (name = 'Test Tenant') => {
  let presented = await forge.tenant.upsert({ identifier: uniqueId('tenant'), name });
  return db.tenant.findUniqueOrThrow({ where: { id: presented.id } });
};

export let createWorkflow = async (tenantId: string, name = 'Test Workflow') =>
  forge.workflow.upsert({ tenantId, identifier: uniqueId('workflow'), name });

export let createVersion = async (input: { tenantId: string; workflowId: string }) =>
  forge.workflowVersion.create({
    ...input,
    name: uniqueId('version'),
    steps: [{ name: 'Build', type: 'script', actionScript: ['echo build'] }]
  });

export let createWorkflowWithVersion = async () => {
  let tenant = await createTenant();
  let workflow = await createWorkflow(tenant.id);
  let version = await createVersion({ tenantId: tenant.id, workflowId: workflow.id });
  return { tenant, workflow, version };
};

export let createFinishedRun = async (input: {
  workflowId: string;
  status?: WorkflowRunStatus;
  output?: [number, string][];
}) => {
  let workflow = await db.workflow.findUniqueOrThrow({ where: { id: input.workflowId } });
  let version = await db.workflowVersion.findFirstOrThrow({
    where: { workflowOid: workflow.oid }
  });

  let id = await ID.generateId('workflowRun');

  let run = await db.workflowRun.create({
    data: {
      oid: snowflake.nextId(),
      id,
      status: input.status ?? 'succeeded',
      startedAt: new Date(),
      endedAt: new Date(),
      workflowOid: workflow.oid,
      versionOid: version.oid,
      providerOid: workflow.providerOid,
      encryptedEnvironmentVariables: await encryption.encrypt({
        secret: JSON.stringify({}),
        entityId: id
      })
    }
  });

  let step = await db.workflowRunStep.create({
    data: {
      oid: snowflake.nextId(),
      id: await ID.generateId('workflowRunStep'),
      name: 'Setup Build Environment',
      type: 'setup',
      status: 'succeeded',
      index: 0,
      runOid: run.oid
    }
  });

  if (input.output) {
    await db.workflowRunOutputTemp.create({
      data: {
        oid: snowflake.nextId(),
        output: input.output.map(line => JSON.stringify(line)).join('\n'),
        runOid: run.oid,
        stepOid: step.oid
      }
    });
  }

  return { run, step };
};
