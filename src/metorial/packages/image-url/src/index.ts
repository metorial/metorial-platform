import { renderSkillIconDataUrl } from '@metorial/skill-icons';

export type EntityImage =
  | {
      type: 'file';
      fileId: string;
      fileLinkId: string;
      fileReferenceId: string;
      fileUrl: string;
      url?: string;
    }
  | { type: 'url'; url: string }
  | { type: 'icon'; icon: string; color: string }
  | { type: 'default' };

type EntityImageOuter = EntityImage;

declare global {
  namespace PrismaJson {
    // @ts-ignore
    type EntityImage = EntityImageOuter;
  }
}

export type GetImageFieldsParams = {
  id: string;
  name?: string | null;
  email?: string | null;
  image: EntityImage | null;
};

export let getImageFieldsDefaultImpl = async (entity: GetImageFieldsParams) => {
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
  // if (entity.email) url.searchParams.set('email', md5(entity.email));

  return {
    imageUrl: url.toString()
  };
};

let impl = { current: getImageFieldsDefaultImpl };

export let setGetImageFieldsImpl = (newImpl: typeof getImageFieldsDefaultImpl) => {
  impl.current = newImpl;
};

export let getImageFields = async (entity: GetImageFieldsParams) => {
  if (entity.image?.type == 'icon') {
    try {
      return { imageUrl: renderSkillIconDataUrl(entity.image) };
    } catch {
      return impl.current({ ...entity, image: { type: 'default' } });
    }
  }

  return impl.current(entity);
};

export let getImageUrl = async (entity: {
  id: string;
  name?: string | null;
  email?: string | null;
  image: EntityImage | null;
}) => (await getImageFields(entity)).imageUrl;
