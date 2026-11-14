import { imageSize } from 'image-size';
import { guardedFetch, type FetchBudget } from './fetch';
import { MAX_IMAGE_BYTES, MAX_SVG_BYTES } from './limits';

export type ImageFormat = NonNullable<PrismaJson.WebImageCandidate['format']>;

export type ImageProbeResult = {
  format: ImageFormat;
  width: number | null;
  height: number | null;
  bytes: number;
};

export class ImageRejectedError extends Error {
  constructor(public reason: 'not_an_image' | 'svg_too_large' | 'invalid_dimensions') {
    super(reason);
  }
}

let startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte);

let maxDimension = 20000;

export let sniffImageFormat = (bytes: Uint8Array): ImageFormat | null => {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) return 'ico';

  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'webp';
  }

  let head = new TextDecoder('utf-8').decode(bytes.subarray(0, 2048));
  let svgIndex = head.search(/<svg[\s>]/i);
  let htmlIndex = head.search(/<html[\s>]/i);

  if (svgIndex >= 0 && (htmlIndex < 0 || svgIndex < htmlIndex)) return 'svg';

  return null;
};

export let probeImage = async (
  url: string,
  budget: FetchBudget
): Promise<ImageProbeResult> => {
  let response = await guardedFetch(url, {
    budget,
    accept: 'image/*,*/*;q=0.5',
    maxBytes: MAX_IMAGE_BYTES
  });

  let format = sniffImageFormat(response.bytes);
  if (!format) throw new ImageRejectedError('not_an_image');

  if (format == 'svg' && response.bytes.length > MAX_SVG_BYTES) {
    throw new ImageRejectedError('svg_too_large');
  }

  let width: number | null = null;
  let height: number | null = null;

  try {
    let size = imageSize(response.bytes);
    width = size.width ?? null;
    height = size.height ?? null;
  } catch {
    if (format != 'svg') throw new ImageRejectedError('invalid_dimensions');
  }

  if (
    width !== null &&
    height !== null &&
    (width <= 0 || height <= 0 || width > maxDimension || height > maxDimension)
  ) {
    throw new ImageRejectedError('invalid_dimensions');
  }

  return { format, width, height, bytes: response.bytes.length };
};
