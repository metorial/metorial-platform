import type { SpecificationToolCategory } from '@metorial-subspace/db';

type SlateToolCategoryInput = {
  key: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
};

/**
 * Normalizes the tool category definitions of a slate specification. Keeps the
 * declared order, drops malformed entries and duplicate keys (first wins), and
 * never writes `undefined` values so the specification hash stays stable.
 */
export let normalizeToolCategories = (
  categories: SlateToolCategoryInput[] | null | undefined
): SpecificationToolCategory[] => {
  let seen = new Set<string>();
  let result: SpecificationToolCategory[] = [];

  for (let category of categories ?? []) {
    if (!category || typeof category.key !== 'string' || !category.key) continue;
    if (typeof category.name !== 'string') continue;
    if (seen.has(category.key)) continue;

    seen.add(category.key);
    result.push({
      key: category.key,
      name: category.name,
      ...(typeof category.description === 'string' && category.description
        ? { description: category.description }
        : {}),
      ...(typeof category.imageUrl === 'string' && category.imageUrl
        ? { imageUrl: category.imageUrl }
        : {})
    });
  }

  return result;
};

/**
 * Returns the tool's category keys that are defined on the specification, in
 * the tool's order and without duplicates. Unknown keys are dropped with a
 * warning instead of failing the whole specification.
 */
export let resolveToolCategoryKeys = (
  keys: string[] | null | undefined,
  definedKeys: Set<string>,
  d: { toolKey: string; specId?: string }
): string[] => {
  let seen = new Set<string>();
  let result: string[] = [];
  let unknownKeys: string[] = [];

  for (let key of keys ?? []) {
    if (typeof key !== 'string' || seen.has(key)) continue;
    seen.add(key);

    if (!definedKeys.has(key)) {
      unknownKeys.push(key);
      continue;
    }

    result.push(key);
  }

  if (unknownKeys.length > 0) {
    console.warn('Dropping unknown tool category keys from slate tool', {
      specId: d.specId,
      toolKey: d.toolKey,
      unknownKeys
    });
  }

  return result;
};
