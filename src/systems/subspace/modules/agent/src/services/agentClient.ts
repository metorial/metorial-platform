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

type AgentClientInput =
  | {
      name: string;
      type: 'mcp_client_oauth';
      privateMetadata?: Record<string, any>;
      foreignId: string;
      oauthRegistrationId: string;
    }
  | {
      name: string;
      type: 'system_client';
      privateMetadata?: Record<string, any>;
      foreignId: string;
    };

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
    input: AgentClientInput;
  }) {
    return await withTransaction(async db => {
      let newId = getId('agentClient');

      let agentClient = await db.agentClient.upsert({
        where: { foreignId: d.input.foreignId },
        create: {
          ...newId,

          name: d.input.name.trim(),
          type: d.input.type,

          privateMetadata: d.input.privateMetadata,
          foreignId: d.input.foreignId,
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
      });

      let agentClientRegistration =
        d.input.type === 'mcp_client_oauth'
          ? await db.agentClientRegistration.upsert({
              where: { oauthRegistrationId: d.input.oauthRegistrationId },
              create: {
                ...getId('agentClientRegistration'),

                oauthRegistrationId: d.input.oauthRegistrationId,
                privateMetadata: d.input.privateMetadata,
                agentClientOid: agentClient.oid
              },
              update: {
                privateMetadata: d.input.privateMetadata,
                agentClientOid: agentClient.oid
              }
            })
          : null;

      let isNew = agentClient.id === newId.id;
      if (isNew) {
        await addAfterTransactionHook(async () =>
          indexAgentClientQueue.add({ agentClientId: agentClient.id })
        );
      }

      return { agentClient, agentClientRegistration };
    });
  }

  async createAgentClient(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: AgentClientInput;
  }) {
    return await this.upsertAgentClient(d);
  }
}

export let agentClientService = Service.create(
  'agentClient',
  () => new agentClientServiceImpl()
).build();
