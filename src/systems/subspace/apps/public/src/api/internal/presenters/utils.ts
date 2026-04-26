type ImageValue =
  | {
      type: 'file';
      fileUrl?: string | null;
      url?: string | null;
    }
  | {
      type: 'url';
      url: string;
    }
  | null
  | undefined;

export let getImageUrl = (entity: {
  id: string;
  image: ImageValue;
}) => {
  if (entity.image?.type === 'file') {
    return entity.image.fileUrl ?? entity.image.url ?? '';
  }

  if (entity.image?.type === 'url') {
    return entity.image.url;
  }

  return new URL(`https://avatar-cdn.metorial.com/aimg_${entity.id.split('_').pop()}`).toString();
};
