import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type {
  ServerDeployment,
  ServerDeploymentStepStatus,
  ServerDeploymentStepType,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { functionBay } from '../functionBay';

type ServerDeploymentOutputStep = {
  object: 'server_deployment.step';
  id: string;
  status: ServerDeploymentStepStatus;
  name: string;
  logs: { timestamp: number; message: string }[];
  type: ServerDeploymentStepType;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  [key: string]: unknown;
};

let include = {
  server: true,
  tenant: true,
  functionServer: true,
  serverVersion: true
};
export let serverDeploymentInclude = include;

class serverDeploymentServiceImpl {
  async getServerDeploymentById(d: { tenant: Tenant; serverDeploymentId: string }) {
    let serverDeployment = await db.serverDeployment.findFirst({
      where: {
        id: d.serverDeploymentId,
        OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
      },
      include
    });
    if (!serverDeployment) throw new ServiceError(notFoundError('server_deployment'));
    return serverDeployment;
  }

  async getServerDeploymentLogs(d: {
    serverDeployment: ServerDeployment;
  }): Promise<ServerDeploymentOutputStep[]> {
    let functionServer = d.serverDeployment.functionServerOid
      ? await db.functionServer.findUnique({
          where: { oid: d.serverDeployment.functionServerOid }
        })
      : null;
    let steps = await db.serverDeploymentStep.findMany({
      where: { deploymentOid: d.serverDeployment.oid },
      orderBy: { createdAt: 'asc' },
      include: {}
    });
    let functionBayOutput = functionServer
      ? await functionBay.functionDeployment.getOutput({
          tenantId: functionServer.functionBayTenantId,
          functionId: functionServer.functionBayFunctionId,
          functionDeploymentId: functionServer.functionBayDeploymentId
        })
      : null;

    return steps
      .map(step => {
        if (step.type == 'deploying' && functionBayOutput) {
          return (functionBayOutput as ServerDeploymentOutputStep[]).map(output => ({
            ...output,
            object: 'server_deployment.step'
          }));
        }

        return [
          {
            object: 'server_deployment.step',
            id: step.id,
            status: step.status,
            name: {
              publishing: 'Publishing Server',
              deploying: 'Deploying Server',
              discovering: 'Discovering Server Capabilities',
              started: 'Deployment Started'
            }[step.type],
            logs: step.logs.flat().map(([timestamp, message]) => ({
              timestamp,
              message
            })) as { timestamp: number; message: string }[],
            type: step.type,
            createdAt: step.createdAt,
            startedAt: step.startedAt,
            endedAt: step.endedAt
          }
        ];
      })
      .flat();
  }

  async listServerDeployments(d: { tenant: Tenant; serverIds?: string[] }) {
    let servers = d.serverIds
      ? await db.server.findMany({
          where: {
            OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }],
            id: { in: d.serverIds }
          },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverDeployment.findMany({
            ...opts,
            where: {
              OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }],
              serverOid: servers ? { in: servers.map(s => s.oid) } : undefined
            },
            include
          })
      )
    );
  }
}

export let serverDeploymentService = Service.create(
  'serverDeploymentService',
  () => new serverDeploymentServiceImpl()
).build();
