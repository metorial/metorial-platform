import { Service } from '@lowerdeck/service';
import { db } from '@metorial-subspace/db';
import {
  identityActorMirrorService,
  resolveMetorialInstance
} from '@metorial-subspace/module-identity';
import { metorialDb } from '@metorial-subspace/module-tenant';

class agentMirrorServiceImpl {
  async syncAgentClient(d: { agentClientId: string }) {
    let agentClient = await db.agentClient.findUnique({
      where: { id: d.agentClientId },
      include: { agentClientRegistrations: true }
    });

    if (!agentClient) {
      await metorialDb.agentClient.deleteMany({ where: { id: d.agentClientId } });
      return null;
    }

    let instance = await resolveMetorialInstance(agentClient);
    if (!instance) return null;

    let consumerClient =
      agentClient.type === 'mcp_client_oauth' && agentClient.foreignId
        ? await metorialDb.consumerClient.findUnique({
            where: { id: agentClient.foreignId },
            select: { oid: true }
          })
        : null;

    let data = {
      type: agentClient.type,
      name: agentClient.name,

      organizationOid: instance.organizationOid,
      projectOid: instance.projectOid,
      instanceOid: instance.oid,
      consumerClientOid: consumerClient?.oid ?? null,

      createdAt: agentClient.createdAt,
      updatedAt: agentClient.updatedAt,
      lastConnectedAt: agentClient.lastConnectedAt
    };

    let mirroredClient = await metorialDb.agentClient.upsert({
      where: { id: agentClient.id },
      create: { oid: agentClient.oid, id: agentClient.id, ...data },
      update: data
    });

    let unattachedRegistrations = await metorialDb.agentClientRegistration.findMany({
      where: {
        agentClientOid: mirroredClient.oid,
        id: {
          notIn: agentClient.agentClientRegistrations.map(registration => registration.id)
        }
      },
      select: { id: true }
    });
    if (unattachedRegistrations.length) {
      let stillExisting = await db.agentClientRegistration.findMany({
        where: { id: { in: unattachedRegistrations.map(registration => registration.id) } },
        select: { id: true }
      });
      let stillExistingIds = new Set(stillExisting.map(registration => registration.id));

      await metorialDb.agentClientRegistration.deleteMany({
        where: {
          id: {
            in: unattachedRegistrations
              .map(registration => registration.id)
              .filter(id => !stillExistingIds.has(id))
          }
        }
      });
    }

    for (let registration of agentClient.agentClientRegistrations) {
      let consumerAuthClient = registration.oauthRegistrationId
        ? await metorialDb.consumerAuthClient.findUnique({
            where: { id: registration.oauthRegistrationId },
            select: { oid: true }
          })
        : null;

      if (consumerAuthClient) {
        await metorialDb.agentClientRegistration.updateMany({
          where: {
            consumerAuthClientOid: consumerAuthClient.oid,
            id: { not: registration.id }
          },
          data: { consumerAuthClientOid: null }
        });
      }

      let registrationData = {
        agentClientOid: mirroredClient.oid,
        consumerAuthClientOid: consumerAuthClient?.oid ?? null,

        createdAt: registration.createdAt,
        updatedAt: registration.updatedAt
      };

      await metorialDb.agentClientRegistration.upsert({
        where: { id: registration.id },
        create: { oid: registration.oid, id: registration.id, ...registrationData },
        update: registrationData
      });
    }

    return mirroredClient;
  }

  async syncAgentInstance(d: { agentInstanceId: string }) {
    let agentInstance = await db.agentInstance.findUnique({
      where: { id: d.agentInstanceId },
      include: {
        agent: { select: { id: true } },
        agentClient: { select: { id: true } },
        agentClientRegistration: { select: { id: true } }
      }
    });

    if (!agentInstance) {
      await metorialDb.agentInstance.deleteMany({ where: { id: d.agentInstanceId } });
      return null;
    }

    let mirroredAgent =
      (await metorialDb.agent.findUnique({
        where: { id: agentInstance.agent.id },
        select: { oid: true }
      })) ?? (await identityActorMirrorService.syncAgent({ agentId: agentInstance.agent.id }));
    if (!mirroredAgent) return null;

    let mirroredClient = agentInstance.agentClient
      ? await this.syncAgentClient({ agentClientId: agentInstance.agentClient.id })
      : null;
    if (agentInstance.agentClient && !mirroredClient) return null;

    let mirroredRegistration = agentInstance.agentClientRegistration
      ? await metorialDb.agentClientRegistration.findUnique({
          where: { id: agentInstance.agentClientRegistration.id },
          select: { oid: true }
        })
      : null;

    let data = {
      type: agentInstance.type,

      name: agentInstance.name,
      version: agentInstance.version,
      description: agentInstance.description,
      hash: agentInstance.hash,

      agentOid: mirroredAgent.oid,
      agentClientOid: mirroredClient?.oid ?? null,
      agentClientRegistrationOid: mirroredRegistration?.oid ?? null,

      createdAt: agentInstance.createdAt,
      updatedAt: agentInstance.updatedAt,
      lastConnectedAt: agentInstance.lastConnectedAt
    };

    return metorialDb.agentInstance.upsert({
      where: { id: agentInstance.id },
      create: { oid: agentInstance.oid, id: agentInstance.id, ...data },
      update: data
    });
  }
}

export let agentMirrorService = Service.create(
  'agentMirror',
  () => new agentMirrorServiceImpl()
).build();
