import { db } from '@metorial-subspace/db';
import {
  IProviderEnrichments,
  type ProviderVariantEnrichmentInput,
  type ProviderVariantEnrichmentOutput,
  type ProviderVersionEnrichmentInput,
  type ProviderVersionEnrichmentOutput
} from '@metorial-subspace/provider-utils';
import { shuttle } from '../client';

type ShuttleServer = Awaited<ReturnType<typeof shuttle.server.getMany>>[number];
type ShuttleServerVersion = Awaited<ReturnType<typeof shuttle.serverVersion.getMany>>[number];

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
    type ShuttleServerRecord = (typeof subspaceShuttleServersList)[number];
    let shuttleServerByVariantId = new Map<
      string,
      (typeof subspaceShuttleServersList)[number]
    >(
      subspaceShuttleServersList.flatMap((s: ShuttleServerRecord) =>
        s.providerVariants.map(
          (v: ShuttleServerRecord['providerVariants'][number]) => [v.id, s] as const
        )
      )
    );

    let shuttleServers = await shuttle.server.getMany({
      serverIds: subspaceShuttleServersList.map((s: ShuttleServerRecord) => s.id)
    });
    let shuttleServersMap = new Map<string, ShuttleServer>(
      shuttleServers.map((s: ShuttleServer) => [s.id, s] as const)
    );

    let currentVersionByVariantId = await this.getCurrentShuttleVersions(input);

    return {
      providers: input.providerVariantIds.map(providerVariantId => {
        let subServer = shuttleServerByVariantId.get(providerVariantId);
        let shuttleServer = subServer ? shuttleServersMap.get(subServer.id) : undefined;
        let source = currentVersionByVariantId.get(providerVariantId) ?? shuttleServer?.draft;

        return {
          providerVariantId,

          containerRegistry: source?.repositoryTag?.repository.registry,
          containerRepository: source?.repositoryTag?.repository,
          containerTag: source?.repositoryTag ?? undefined,

          remoteUrl: source?.remoteUrl ?? undefined,
          remoteProtocol: source?.remoteProtocol ?? undefined
        };
      })
    };
  }

  private async getCurrentShuttleVersions(input: ProviderVariantEnrichmentInput) {
    let variants = await db.providerVariant.findMany({
      where: {
        id: { in: input.providerVariantIds },
        currentVersion: { shuttleServerVersionOid: { not: null } }
      },
      select: {
        id: true,
        currentVersion: { select: { shuttleServerVersion: { select: { id: true } } } }
      }
    });

    let versionIdByVariantId = new Map<string, string>();
    for (let variant of variants) {
      let versionId = variant.currentVersion?.shuttleServerVersion?.id;
      if (versionId) versionIdByVariantId.set(variant.id, versionId);
    }

    if (!versionIdByVariantId.size) return new Map<string, ShuttleServerVersion>();

    let shuttleServerVersions = await shuttle.serverVersion.getMany({
      serverVersionIds: [...new Set(versionIdByVariantId.values())]
    });
    let shuttleServerVersionsMap = new Map<string, ShuttleServerVersion>(
      shuttleServerVersions.map((s: ShuttleServerVersion) => [s.id, s] as const)
    );

    let result = new Map<string, ShuttleServerVersion>();
    for (let [variantId, versionId] of versionIdByVariantId) {
      let version = shuttleServerVersionsMap.get(versionId);
      if (version) result.set(variantId, version);
    }

    return result;
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
    type ShuttleServerVersionRecord = (typeof subspaceShuttleServersList)[number];
    let shuttleServerByVersionId = new Map<
      string,
      (typeof subspaceShuttleServersList)[number]
    >(
      subspaceShuttleServersList.flatMap((s: ShuttleServerVersionRecord) =>
        s.providerVersions.map(
          (v: ShuttleServerVersionRecord['providerVersions'][number]) => [v.id, s] as const
        )
      )
    );

    let shuttleServerVersions = await shuttle.serverVersion.getMany({
      serverVersionIds: subspaceShuttleServersList.map((s: ShuttleServerVersionRecord) => s.id)
    });
    let shuttleServerVersionsMap = new Map<string, ShuttleServerVersion>(
      shuttleServerVersions.map((s: ShuttleServerVersion) => [s.id, s] as const)
    );

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
