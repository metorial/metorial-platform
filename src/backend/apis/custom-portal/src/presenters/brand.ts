import { getImageUrl, ProjectBrand } from '@metorial/db';

export let brandPresenter = async (brand: ProjectBrand) => ({
  object: 'portal#brand' as const,
  id: brand.id,
  name: brand.name,
  imageUrl: await getImageUrl(brand)
});
