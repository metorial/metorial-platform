import { generatePlainId } from '@lowerdeck/id';
import { slugify } from '@lowerdeck/slugify';
import { withTransaction } from '@metorial/db';

export let getSkillPluginSlug = (input: string) =>
  slugify(input.replaceAll('_', '-')) || generatePlainId(8).toLowerCase();

let isSkillPluginSlugAvailable = async (slug: string) =>
  await withTransaction(
    async db => {
      let [localPlugin, cellPlugin] = await Promise.all([
        db.skillPlugin.findFirst({ where: { slug }, select: { id: true } }),
        db.cellSkillPlugin.findFirst({ where: { slug }, select: { id: true } })
      ]);

      return !localPlugin && !cellPlugin;
    },
    { ifExists: true }
  );

export let getAvailableSkillPluginSlug = async (input: string) => {
  let baseSlug = getSkillPluginSlug(input);
  if (await isSkillPluginSlugAvailable(baseSlug)) return baseSlug;

  for (let suffix = 2; suffix < 50; suffix++) {
    let candidate = `${baseSlug}-${suffix}`;
    if (await isSkillPluginSlugAvailable(candidate)) return candidate;
  }

  return `${baseSlug}-${generatePlainId(6).toLowerCase()}`;
};

let isMarketplacePluginSlugAvailable = async (
  slug: string,
  d: { skillMarketplaceId: string }
) =>
  await withTransaction(
    async db =>
      !(await db.skillMarketplacePlugin.findFirst({
        where: {
          skillMarketplace: {
            id: d.skillMarketplaceId
          },
          pluginSlug: slug
        }
      })),
    { ifExists: true }
  );

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
