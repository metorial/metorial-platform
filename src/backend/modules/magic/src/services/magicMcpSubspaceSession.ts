import {
  db,
  ID,
  Instance,
  MagicMcpServer,
  Organization,
  OrganizationActor,
  Prisma
} from '@metorial/db';
import { createLock } from '@metorial/lock';
import {
  subspaceSessionProviderService,
  subspaceSessionService
} from '@metorial/module-subspace';
import { Service } from '@metorial/service';

let ensureSessionLock = createLock({
  name: 'mgc/ses/ens'
});

let toMetadataRecord = (metadata: unknown): Record<string, unknown> => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
};

class MagicMcpSubspaceSessionImpl {
  async ensureSessionForMagicServer(d: {
    magicMcpServer: Pick<
      MagicMcpServer,
      'oid' | 'id' | 'name' | 'description' | 'metadata' | 'subspaceSessionTemplateId'
    >;
    instance: Instance;
    organization: Organization;
    organizationActor?: OrganizationActor;
  }) {
    let sessionTemplateId = d.magicMcpServer.subspaceSessionTemplateId;
    if (!sessionTemplateId) {
      throw new Error('Magic MCP server is missing subspaceSessionTemplateId');
    }

    return ensureSessionLock.usingLock(`${d.instance.id}:${d.magicMcpServer.id}`, async () => {
      let existing = await db.magicMcpServerSubspaceSession.findUnique({
        where: { magicMcpServerOid: d.magicMcpServer.oid }
      });
      if (existing?.subspaceSessionTemplateId === sessionTemplateId) return existing;
      if (existing) {
        await db.magicMcpServerSubspaceSession.delete({
          where: { magicMcpServerOid: d.magicMcpServer.oid }
        });

        await this.cleanupSessionForTemplateChange({
          instance: d.instance,
          organization: d.organization,
          subspaceSessionId: existing.subspaceSessionId,
          replacementSessionTemplateId: sessionTemplateId
        });
      }

      let subspaceSession = await subspaceSessionService.create({
        instance: d.instance,
        organization: d.organization,
        name: d.magicMcpServer.name ?? `Magic MCP ${d.magicMcpServer.id}`,
        description: d.magicMcpServer.description ?? undefined,
        metadata: toMetadataRecord(d.magicMcpServer.metadata),
        providers: [{ sessionTemplateId }]
      });

      try {
        return await db.magicMcpServerSubspaceSession.create({
          data: {
            id: await ID.generateId('magicMcpServerSubspaceSession'),
            magicMcpServerOid: d.magicMcpServer.oid,
            instanceOid: d.instance.oid,
            subspaceSessionId: subspaceSession.id,
            subspaceSessionTemplateId: sessionTemplateId
          }
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          let winner = await db.magicMcpServerSubspaceSession.findUnique({
            where: { magicMcpServerOid: d.magicMcpServer.oid }
          });
          if (winner?.subspaceSessionTemplateId === sessionTemplateId) return winner;
        }

        throw e;
      }
    });
  }

  async cleanupSessionForTemplateChange(d: {
    instance: Instance;
    organization: Organization;
    subspaceSessionId: string;
    replacementSessionTemplateId: string;
  }) {
    // Subspace paginator enforces max limit=100, so page through provider ids first.
    let providerIds: string[] = [];
    let after: string | undefined;

    for (let i = 0; i < 100; i++) {
      let sessionProviders = await subspaceSessionProviderService.list({
        instance: d.instance,
        organization: d.organization,
        sessionIds: [d.subspaceSessionId],
        limit: 100,
        after
      });

      for (let provider of sessionProviders.items) {
        providerIds.push(provider.id);
      }

      if (!sessionProviders.pagination.has_more_after || sessionProviders.items.length === 0) {
        break;
      }

      let nextAfter = sessionProviders.items[sessionProviders.items.length - 1]?.id;
      if (!nextAfter || nextAfter === after) {
        break;
      }

      after = nextAfter;
    }

    for (let providerId of providerIds) {
      await subspaceSessionProviderService
        .delete({
          instance: d.instance,
          organization: d.organization,
          sessionProviderId: providerId
        })
        .catch(() => null);
    }

    let currentMetadata = await subspaceSessionService
      .get({
        instance: d.instance,
        organization: d.organization,
        sessionId: d.subspaceSessionId
      })
      .then((session: Awaited<ReturnType<typeof subspaceSessionService.get>>) =>
        toMetadataRecord(session.metadata)
      )
      .catch(() => ({}));

    await subspaceSessionService
      .update({
        instance: d.instance,
        organization: d.organization,
        sessionId: d.subspaceSessionId,
        metadata: {
          ...currentMetadata,
          metorialMagicMcpState: 'superseded',
          metorialMagicMcpSupersededAt: new Date().toISOString(),
          metorialMagicMcpReplacementTemplateId: d.replacementSessionTemplateId
        }
      })
      .catch(() => null);
  }
}

export let magicMcpSubspaceSessionService = Service.create(
  'magicMcpSubspaceSession',
  () => new MagicMcpSubspaceSessionImpl()
).build();
