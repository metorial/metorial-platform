import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generateCode } from '@metorial/id';
import { globalDB } from '../db';

type SlugClaim = { id: string; createdAt: Date | string };

let MAX_SUFFIX_ATTEMPTS = 10;

let claimsBefore = (a: SlugClaim, b: SlugClaim) => {
  let aTime = new Date(a.createdAt).getTime();
  let bTime = new Date(b.createdAt).getTime();

  return aTime < bTime || (aTime === bTime && a.id < b.id);
};

let getActiveGlobalSlugClaims = (slug: string, exceptId: string) =>
  globalDB.skillPlugin.findMany({
    where: { slug, status: 'active', id: { not: exceptId } },
    select: { id: true, createdAt: true }
  });

let isSlugFree = async (slug: string, exceptId: string) => {
  let [globalClaim, localClaim, cellClaim] = await Promise.all([
    globalDB.skillPlugin.findFirst({
      where: { slug, id: { not: exceptId } },
      select: { id: true }
    }),
    db.skillPlugin.findFirst({
      where: { slug, id: { not: exceptId } },
      select: { id: true }
    }),
    db.cellSkillPlugin.findFirst({
      where: { slug, id: { not: exceptId } },
      select: { id: true }
    })
  ]);

  return !globalClaim && !localClaim && !cellClaim;
};

let findFreeSlug = async (slug: string, exceptId: string) => {
  for (let attempt = 0; attempt < MAX_SUFFIX_ATTEMPTS; attempt++) {
    let candidate = `${slug}-${generateCode(4)}`;
    if (await isSlugFree(candidate, exceptId)) return candidate;
  }

  return `${slug}-${generateCode(8)}`;
};

// The oldest active plugin keeps a slug across every cell; younger ones are renamed locally.
export let reconcileSkillPluginSlug = async (skillPlugin: {
  id: string;
  slug: string | null;
  status: string;
  createdAt: Date | string;
}) => {
  if (skillPlugin.status !== 'active' || !skillPlugin.slug) return skillPlugin.slug;

  let claims = await getActiveGlobalSlugClaims(skillPlugin.slug, skillPlugin.id);
  if (!claims.some(claim => claimsBefore(claim, skillPlugin))) return skillPlugin.slug;

  let previousSlug = skillPlugin.slug;
  let slug = await findFreeSlug(previousSlug, skillPlugin.id);

  let updated = await db.skillPlugin
    .updateMany({
      where: { id: skillPlugin.id, slug: previousSlug },
      data: { slug }
    })
    .catch((error: any) => {
      if (error?.code === 'P2002') return null;
      throw error;
    });
  if (!updated) return previousSlug;
  if (updated.count === 0) {
    let current = await db.skillPlugin.findUnique({
      where: { id: skillPlugin.id },
      select: { slug: true }
    });
    return current?.slug ?? null;
  }

  console.warn('global_skill_plugin_sync.slug_reassigned', {
    skillPluginId: skillPlugin.id,
    previousSlug,
    slug
  });

  await Fabric.fire('skill.plugin.slug.reassigned:after', {
    skillPlugin: await db.skillPlugin.findUniqueOrThrow({ where: { id: skillPlugin.id } }),
    previousSlug
  });

  return slug;
};

export let findYoungerLocalSlugClaims = async (claim: SlugClaim & { slug: string | null }) => {
  if (!claim.slug) return [];

  let localClaims = await db.skillPlugin.findMany({
    where: { slug: claim.slug, status: 'active', id: { not: claim.id } },
    select: { id: true, createdAt: true }
  });

  return localClaims.filter(localClaim => claimsBefore(claim, localClaim));
};
