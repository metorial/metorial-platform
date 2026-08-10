import { db, type ProductAssistantModelProvider } from '@metorial/db';
import { getId } from '../../id';

export type ProviderSlug = string;

export interface Provider {
  _persisted: ProductAssistantModelProvider;
  slug: ProviderSlug;
  name: string;
  imageUrl: string;
}

export let provider = async (d: { slug: ProviderSlug; name: string }): Promise<Provider> => {
  let imageUrl = `https://models.dev/logos/${d.slug}.svg`;

  let _persisted = await db.productAssistantModelProvider.upsert({
    where: { slug: d.slug },
    update: { name: d.name, imageUrl },
    create: {
      ...getId('productAssistantModelProvider'),
      slug: d.slug,
      name: d.name,
      imageUrl
    }
  });

  return {
    _persisted,
    slug: d.slug,
    name: d.name,
    imageUrl
  };
};
