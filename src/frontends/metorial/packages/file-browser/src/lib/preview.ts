import { extname } from './path';

export let TEXT_FULL_READ_LIMIT = 2 * 1024 * 1024;
export let TEXT_CHUNK_SIZE = 1024 * 1024;
export let IMAGE_PREVIEW_LIMIT = 20 * 1024 * 1024;
export let SNIFF_SIZE = 8 * 1024;

let imageTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp'
};

export let getImageMimeType = (path: string) => imageTypes[extname(path)] ?? null;

export let looksLikeText = (bytes: Uint8Array) => {
  let sample = bytes.subarray(0, SNIFF_SIZE);
  if (sample.includes(0)) return false;

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample, { stream: true });
    return true;
  } catch {
    return false;
  }
};

export type UnsupportedReason = 'not-file' | 'image-too-large' | 'binary';

export type PreviewPlan =
  | { kind: 'image'; mimeType: string }
  | { kind: 'text'; partial: boolean }
  | { kind: 'unsupported'; reason: UnsupportedReason };

export let planPreview = (entry: {
  path: string;
  size: number;
  type?: string;
}): PreviewPlan => {
  if (entry.type == 'other' || entry.type == 'directory') {
    return { kind: 'unsupported', reason: 'not-file' };
  }

  let mimeType = getImageMimeType(entry.path);

  if (mimeType) {
    if (entry.size > IMAGE_PREVIEW_LIMIT) {
      return { kind: 'unsupported', reason: 'image-too-large' };
    }

    return { kind: 'image', mimeType };
  }

  return { kind: 'text', partial: entry.size > TEXT_FULL_READ_LIMIT };
};
