/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * Uploads an image and resolves to the URL the editor should embed.
 *
 * Implementations are free to upload to S3, a CDN, etc. The default
 * implementation in this app is a stub that converts the file into a
 * `data:` URI so we can demo the flow without a backend.
 */
export type ImageUploadFn = (file: File) => Promise<string>;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });
}

/** Default stub: produce a `data:` URI from the file after a fake 5s upload delay. */
export let dataUriUploader: ImageUploadFn = async file => {
  let dataUri = await new Promise<string>((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => {
      let result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read image file as data URI'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
  await delay(5000);
  return dataUri;
};

let ImageUploadContext = createContext<ImageUploadFn>(dataUriUploader);

interface ImageUploadProviderProps {
  /** Replace the default uploader. Falls back to the data-URI stub. */
  upload?: ImageUploadFn;
  children: ReactNode;
}

export function ImageUploadProvider({ upload, children }: ImageUploadProviderProps) {
  let value = useMemo(() => upload ?? dataUriUploader, [upload]);
  return <ImageUploadContext.Provider value={value}>{children}</ImageUploadContext.Provider>;
}

/** Access the configured image-upload function. */
export function useImageUpload(): ImageUploadFn {
  return useContext(ImageUploadContext);
}
