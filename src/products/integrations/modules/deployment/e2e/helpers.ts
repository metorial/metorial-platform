import { createRemoteProvider, eventually, type useOrganization } from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';

type Organization = ReturnType<typeof useOrganization>;

export let createDeployableProvider = async (org: Organization, url: string) => {
  let { providerId } = await createRemoteProvider(org.clients.instance, { url });

  return eventually(
    async () => {
      let provider = await subspaceDb.provider.findUniqueOrThrow({
        where: { id: providerId },
        include: { defaultVariant: { include: { currentVersion: true } } }
      });
      if (!provider.defaultVariant?.currentVersion?.specificationOid) {
        throw new Error(`Provider ${providerId} has no specification yet`);
      }

      return provider;
    },
    { timeoutMs: 60_000, intervalMs: 500 }
  );
};
