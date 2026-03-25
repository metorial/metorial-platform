import { db } from '@metorial-subspace/db';
import {
  IProviderEnrichments,
  type ProviderVariantEnrichmentInput,
  type ProviderVariantEnrichmentOutput,
  type ProviderVersionEnrichmentInput,
  type ProviderVersionEnrichmentOutput
} from '@metorial-subspace/provider-utils';
import { shuttle } from '../client';

export class ProviderEnrichments extends IProviderEnrichments {
  override async enrichProviderVariants(
    input: ProviderVariantEnrichmentInput
  ): Promise<ProviderVariantEnrichmentOutput> {
    let subspaceShuttleServersList = await db.shuttleServer.findMany({
      where: {
        providerVariants: {
          some: {
            id: { in: input.providerVariantIds }
          }
        }
      },
      include: { providerVariants: true }
    });
    let shuttleServerByVariantId = new Map(
      subspaceShuttleServersList.flatMap(s => s.providerVariants.map(v => [v.id, s]))
    );

    let shuttleServers = await shuttle.server.getMany({
      serverIds: subspaceShuttleServersList.map(s => s.id)
    });
    let shuttleServersMap = new Map(shuttleServers.map(s => [s.id, s]));

    return {
      providers: input.providerVariantIds.map(providerVariantId => {
        let subServer = shuttleServerByVariantId.get(providerVariantId);
        let shuttleServer = subServer ? shuttleServersMap.get(subServer.id) : undefined;

        return {
          providerVariantId,

          containerRegistry: shuttleServer?.draft.repositoryTag?.repository.registry,
          containerRepository: shuttleServer?.draft.repositoryTag?.repository,
          containerTag: shuttleServer?.draft.repositoryTag ?? undefined,

          remoteUrl: shuttleServer?.draft.remoteUrl ?? undefined,
          remoteProtocol: shuttleServer?.draft.remoteProtocol ?? undefined
        };
      })
    };
  }

  override async enrichProviderVersions(
    input: ProviderVersionEnrichmentInput
  ): Promise<ProviderVersionEnrichmentOutput> {
    let subspaceShuttleServersList = await db.shuttleServerVersion.findMany({
      where: {
        providerVersions: {
          some: {
            id: { in: input.providerVersionIds }
          }
        }
      },
      include: { providerVersions: true }
    });
    let shuttleServerByVersionId = new Map(
      subspaceShuttleServersList.flatMap(s => s.providerVersions.map(v => [v.id, s]))
    );

    let shuttleServerVersions = await shuttle.serverVersion.getMany({
      serverVersionIds: subspaceShuttleServersList.map(s => s.id)
    });
    let shuttleServerVersionsMap = new Map(shuttleServerVersions.map(s => [s.id, s]));

    return {
      providers: input.providerVersionIds.map(providerVersionId => {
        let subVersion = shuttleServerByVersionId.get(providerVersionId);
        let shuttleVersion = subVersion
          ? shuttleServerVersionsMap.get(subVersion.id)
          : undefined;

        return {
          providerVersionId,

          containerRegistry: shuttleVersion?.repositoryTag?.repository.registry,
          containerRepository: shuttleVersion?.repositoryTag?.repository,
          containerTag: shuttleVersion?.repositoryTag ?? undefined,
          containerVersion: shuttleVersion?.repositoryVersion ?? undefined,

          remoteUrl: shuttleVersion?.remoteUrl ?? undefined,
          remoteProtocol: shuttleVersion?.remoteProtocol ?? undefined
        };
      })
    };
  }
}
