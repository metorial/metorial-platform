export let getImageFields = (entity: {
  id: string;
  name?: string | null;
  email?: string | null;
  image: PrismaJson.EntityImage | null;
}) => {
  if (entity.image?.type == 'file') {
    return {
      imageUrl: entity.image.url,
      imageFileReference: {
        __typename: 'file_reference',
        objectId: entity.id,
        type: entity.image.type,
        fileId: entity.image.fileId,
        fileLinkId: entity.image.fileLinkId
      }
    };
  }

  if (entity.image?.type == 'url') {
    return {
      imageUrl: entity.image.url,
      imageFileReference: null
    };
  }

  let url = new URL(`https://avatar-cdn.metorial.com/aimg_${entity.id.split('_').pop()}`);
  // if (entity.email) url.searchParams.set('email', md5(entity.email));

  return {
    imageUrl: url.toString(),
    imageFileReference: null
  };
};

export let getImageUrl = (entity: {
  id: string;
  name?: string | null;
  email?: string | null;
  image: PrismaJson.EntityImage | null;
}) => getImageFields(entity).imageUrl;
