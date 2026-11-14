import { getImageUrl } from '@metorial/image-url';
import type { Brand } from '@metorial-subspace/db';

export let setupSessionBrandPresenter = async (brand: Brand) => ({
  object: 'brand',

  id: brand.id,
  name: brand.name,
  imageUrl: await getImageUrl({
    id: brand.id,
    image: brand.image
  }),

  createdAt: brand.createdAt
});
