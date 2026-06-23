import type { Brand } from '@metorial-subspace/db';
import { getImageUrl } from './utils';

export let setupSessionBrandPresenter = (brand: Brand) => ({
  object: 'brand',

  id: brand.id,
  name: brand.name,
  imageUrl: getImageUrl({
    id: brand.id,
    image: brand.image
  }),

  createdAt: brand.createdAt
});
