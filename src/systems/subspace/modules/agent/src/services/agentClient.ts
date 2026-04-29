import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type AgentClientType,
  db,
  type Environment,
  getId,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter } from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { indexAgentClientQueue } from '../queues/search/agentClient';

class agentClientServiceImpl {
  async listAgentClients(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    types?: AgentClientType[];
    ids?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.agentClient.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.agentClient.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types ? { type: { in: d.types } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            }
          })
      )
    );
  }

  async getAgentClientById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    agentClientId: string;
  }) {
    let agentClient = await db.agentClient.findFirst({
      where: {
        id: d.agentClientId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      }
    });
    if (!agentClient) throw new ServiceError(notFoundError('agent.client', d.agentClientId));

    return agentClient;
  }

  async upsertAgentClient(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      name: string;
      type: AgentClientType;
      privateMetadata?: Record<string, any>;
      oauthRegistrationId?: string;
    };
  }) {
    return await withTransaction(async db => {
      let oauthRegistrationId = d.input.oauthRegistrationId?.trim() || undefined;
      let newId = getId('agentClient');

      let agentClient = oauthRegistrationId
        ? await db.agentClient.upsert({
            where: { oauthRegistrationId },
            create: {
              ...newId,

              name: d.input.name.trim(),
              type: d.input.type,

              privateMetadata: d.input.privateMetadata,
              oauthRegistrationId,
              lastConnectedAt: new Date(),

              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid
            },
            update: {
              name: d.input.name.trim(),
              type: d.input.type,
              privateMetadata: d.input.privateMetadata,
              lastConnectedAt: new Date(),
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid
            }
          })
        : await db.agentClient.create({
            data: {
              ...getId('agentClient'),

              name: d.input.name.trim(),
              type: d.input.type,

              privateMetadata: d.input.privateMetadata,
              oauthRegistrationId,
              lastConnectedAt: new Date(),

              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid
            }
          });

      let isNew = agentClient.oid == newId.oid;

      if (isNew) {
        await addAfterTransactionHook(async () =>
          indexAgentClientQueue.add({ agentClientId: agentClient.id })
        );
      }

      return agentClient;
    });
  }

  async createAgentClient(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      name: string;
      type: AgentClientType;
      privateMetadata?: Record<string, any>;
      oauthRegistrationId?: string;
    };
  }) {
    return await this.upsertAgentClient(d);
  }
}

export let agentClientService = Service.create(
  'agentClient',
  () => new agentClientServiceImpl()
).build();
