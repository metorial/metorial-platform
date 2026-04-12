import type { FunctionBayRuntimeSpec } from '@function-bay/types';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Function, FunctionDeployment, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { encryption } from '../encryption';
import { forge } from '../forge';
import { ID, snowflake } from '../id';
import { defaultProvider } from '../providers';
import { startBuildQueue } from '../queues/build';

let include = {
  function: {
    include: {
      currentVersion: true
    }
  },
  runtime: {
    include: {
      provider: true
    }
  },
  functionVersion: true,
  steps: true
};

class functionDeploymentServiceImpl {
  async createFunctionDeployment(d: {
    function: Function;
    tenant: Tenant;
    input: {
      name: string;
      env: Record<string, string>;
      files: {
        filename: string;
        content: string;
        encoding?: 'utf-8' | 'base64';
      }[];
      runtime: FunctionBayRuntimeSpec;
      config: PrismaJson.FunctionConfiguration;
    };
  }) {
    let providerRuntime = await defaultProvider.getRuntime(d.input.runtime);

    let id = await ID.generateId('functionDeployment');

    let deployment = await db.functionDeployment.create({
      data: {
        oid: snowflake.nextId(),
        id,
        status: 'pending',
        identifier: generatePlainId(12),
        name: d.input.name,
        configuration: d.input.config,
        runtimeOid: providerRuntime.runtime.oid,
        functionOid: d.function.oid,

        steps: {
          create: [
            {
              oid: snowflake.nextId(),
              id: await ID.generateId('functionDeploymentStep'),
              status: 'pending',
              type: 'deploy',
              name: 'Deploy Function',
              output: ''
            }
          ]
        },

        encryptedEnvironmentVariables: await encryption.encrypt({
          secret: JSON.stringify(d.input.env),
          entityId: id
        })
      },
      include
    });

    await startBuildQueue.add({ deploymentId: deployment.id, files: d.input.files });

    return deployment;
  }

  async getFunctionDeploymentById(d: { id: string; function: Function }) {
    let functionDeployment = await db.functionDeployment.findFirst({
      where: {
        OR: [{ id: d.id }, { identifier: d.id }],
        functionOid: d.function.oid
      },
      include
    });
    if (!functionDeployment) throw new ServiceError(notFoundError('function.deployment'));
    return functionDeployment;
  }

  async getFunctionDeploymentOutput(d: { deployment: FunctionDeployment }) {
    let func = await db.function.findFirstOrThrow({
      where: {
        oid: d.deployment.functionOid
      },
      include: {
        tenant: true
      }
    });

    let steps = await db.functionDeploymentStep.findMany({
      where: {
        functionDeploymentOid: d.deployment.oid
      }
    });

    let forgeLogs = d.deployment.forgeRunId
      ? await forge.workflowRun.getOutput({
          tenantId: func.tenant.identifier,
          workflowRunId: d.deployment.forgeRunId,
          workflowId: d.deployment.forgeWorkflowId!
        })
      : null;

    return {
      steps: [
        ...(forgeLogs ?? []).map(s => ({
          id: `forge#${s.step.id}`,
          name: s.step.name,
          type: 'build' as const,
          status: s.step.status,
          logs: s.logs,
          createdAt: s.step.createdAt,
          startedAt: s.step.startedAt,
          endedAt: s.step.endedAt
        })),

        ...steps.map(s => ({
          id: `function-bay#${s.id}`,
          name: s.name,
          type: s.type,
          status: s.status,

          createdAt: s.createdAt,
          startedAt: s.startedAt,
          endedAt: s.endedAt,

          logs: !s.output
            ? []
            : s.output
                .split('\n')
                .map(line => {
                  if (!line.startsWith('[')) return undefined!;
                  let [ts, message] = JSON.parse(line);

                  return {
                    timestamp: ts,
                    message
                  };
                })
                .filter(Boolean)
        }))
      ]
    };
  }

  async listFunctionDeployments(d: { function: Function }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.functionDeployment.findMany({
            ...opts,
            where: {
              functionOid: d.function.oid
            },
            include
          })
      )
    );
  }
}

export let functionDeploymentService = Service.create(
  'functionDeploymentService',
  () => new functionDeploymentServiceImpl()
).build();
