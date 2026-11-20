import { createCachedFunction } from '@lowerdeck/cache';
import { db } from '@mtsrc/ai-gateway-db';
import { routeService } from '@mtsrc/ai-gateway-module-routing';
import type { VirtualModelDefinition } from '@mtsrc/ai-gateway-spec';
import { env } from '../env';
import type { TargetProfile } from './targets';

export type ActiveVirtualModel = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  versionId: string;
  versionNumber: number;
  definition: VirtualModelDefinition;
  createdAt: Date;
};

export let getInstanceVirtualModels = createCachedFunction<
  { instanceId: string },
  ActiveVirtualModel[]
>({
  name: 'ai-gateway/instance-virtual-models',
  redisUrl: env.service.REDIS_URL,
  ttlSeconds: 300,
  getHash: i => i.instanceId,

  provider: async i => {
    let virtualModels = await db.virtualModel.findMany({
      where: {
        instance: { id: i.instanceId },
        archivedAt: null,
        currentVersionOid: { not: null }
      },
      include: { currentVersion: true },
      orderBy: { slug: 'asc' }
    });

    return virtualModels.map(virtualModel => ({
      id: virtualModel.id,
      slug: virtualModel.slug,
      name: virtualModel.name,
      description: virtualModel.description,
      versionId: virtualModel.currentVersion!.id,
      versionNumber: virtualModel.currentVersion!.number,
      definition: virtualModel.currentVersion!.definition,
      createdAt: virtualModel.createdAt
    }));
  }
});

export let forgetInstanceVirtualModels = (instanceId: string) =>
  getInstanceVirtualModels.clearAndWait({ instanceId });

export let findActiveVirtualModel = async (d: { instanceId: string; slug: string }) => {
  let slug = d.slug.trim().toLowerCase();
  if (slug.includes('/') || slug.includes(':')) return null;

  let virtualModels = await getInstanceVirtualModels({ instanceId: d.instanceId });
  return virtualModels.find(virtualModel => virtualModel.slug == slug) ?? null;
};

export let loadTargetProfiles = async (targets: string[]) => {
  let resolved = await Promise.all(
    targets.map(async target => {
      let result = await routeService.resolveModel({ model: target }).catch(() => null);
      return result ? ([target, result.model.slug] as const) : null;
    })
  );

  let slugs = [...new Set(resolved.flatMap(entry => (entry ? [entry[1]] : [])))];
  let models = await db.model.findMany({
    where: { slug: { in: slugs }, removedAt: null },
    select: { slug: true, contextTokens: true, inputModalities: true, capabilities: true }
  });
  let bySlug = new Map(models.map(model => [model.slug, model]));

  let profiles: Record<string, TargetProfile> = {};
  for (let entry of resolved) {
    let model = entry && bySlug.get(entry[1]);
    if (!entry || !model) continue;

    profiles[entry[0]] = {
      modelSlug: model.slug,
      contextTokens: model.contextTokens,
      inputModalities: model.inputModalities,
      supportsTools: model.capabilities?.tools ?? true
    };
  }

  return profiles;
};

export let getTargetProfiles = createCachedFunction<
  { versionId: string; targets: string[] },
  Record<string, TargetProfile>
>({
  name: 'ai-gateway/virtual-model-target-profiles',
  redisUrl: env.service.REDIS_URL,
  ttlSeconds: 600,
  getHash: i => i.versionId,
  provider: async i => await loadTargetProfiles(i.targets)
});
