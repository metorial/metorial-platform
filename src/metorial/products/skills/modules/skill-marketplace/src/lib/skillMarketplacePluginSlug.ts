import { generatePlainId } from '@lowerdeck/id';
import { slugify } from '@lowerdeck/slugify';
import { db } from '@metorial/db';

export let getSkillPluginSlug = (input: string) =>
  slugify(input.replaceAll('_', '-')) || generatePlainId(8).toLowerCase();

let isMarketplacePluginSlugAvailable = async (
  slug: string,
  d: { skillMarketplaceId: string }
) =>
  !(await db.skillMarketplacePlugin.findFirst({
    where: {
      skillMarketplace: {
        id: d.skillMarketplaceId
      },
      pluginSlug: slug
    }
  }));

export let getMarketplacePluginSlug = async (
  d: { input: string; current?: string },
  opts: { skillMarketplaceId: string }
) => {
  let baseSlug = slugify(d.input) || generatePlainId(8).toLowerCase();

  if (d.current === baseSlug) return baseSlug;
  if (await isMarketplacePluginSlugAvailable(baseSlug, opts)) return baseSlug;

  for (let suffix = 2; suffix < 50; suffix++) {
    let candidate = `${baseSlug}-${suffix}`;

    if (d.current === candidate) return candidate;
    if (await isMarketplacePluginSlugAvailable(candidate, opts)) return candidate;
  }

  return `${baseSlug}-${generatePlainId(6).toLowerCase()}`;
};

export let getArchivedMarketplacePluginSlug = async (d: { skillMarketplaceId: string }) =>
  await getMarketplacePluginSlug(
    { input: generatePlainId(20).toLowerCase() },
    { skillMarketplaceId: d.skillMarketplaceId }
  );
