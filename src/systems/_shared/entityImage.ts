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
  | { type: 'default' };

type EntityImageOuter = EntityImage;

declare global {
  namespace PrismaJson {
    type EntityImage = EntityImageOuter;
  }
}

