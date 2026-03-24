import type { Brand } from '@metorial-subspace/db';

let getImageUrl = (image: Brand['image']): string | null => {
  if (image?.type === 'file') return image.fileUrl ?? image.url ?? null;
  if (image?.type === 'url') return image.url ?? null;
  return null;
};

export let brandPresenter = (brand: Brand) => ({
  object: 'brand',

  id: brand.id,
  name: brand.name,
  image: getImageUrl(brand.image),

  createdAt: brand.createdAt
});
