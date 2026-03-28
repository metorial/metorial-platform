import type { Brand } from '@metorial-subspace/db';

export type GetImageFieldsParams = {
  id: string;
  name?: string | null;
  image: Brand['image'] | null;
};

export let getImageFields = (entity: GetImageFieldsParams) => {
  if (entity.image?.type == 'file') {
    return {
      imageUrl: entity.image.fileUrl ?? entity.image.url ?? ''
    };
  }

  if (entity.image?.type == 'url') {
    return {
      imageUrl: entity.image.url
    };
  }

  let url = new URL(`https://avatar-cdn.metorial.com/aimg_${entity.id.split('_').pop()}`);

  return {
    imageUrl: url.toString()
  };
};

export let getImageUrl = (entity: {
  id: string;
  name?: string | null;
  image: Brand['image'] | null;
}) => getImageFields(entity).imageUrl;

export let brandPresenter = (brand: Brand) => ({
  object: 'brand',

  id: brand.id,
  name: brand.name,
  imageUrl: getImageUrl(brand),

  createdAt: brand.createdAt
});
