let octetStreamMediaType = 'application/octet-stream';
let defaultDocumentContentType = 'text/plain; charset=utf-8';

let mediaTypeTokenPattern = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;
let charsetPattern = /^[a-z0-9][a-z0-9._:+-]{0,39}$/;
let singleValuePattern = /^[\x20-\x2b\x2d-\x7e]*$/;

let passiveMediaTypes = new Set([
  'application/pdf',

  'image/png',
  'image/apng',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/tiff',
  'image/heic',
  'image/heif',

  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-m4v',
  'video/mpeg',
  'video/3gpp',
  'video/x-matroska',

  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/aac',
  'audio/flac',
  'audio/x-flac',
  'audio/x-m4a',
  'audio/opus',
  'audio/3gpp'
]);

export type ParsedMediaType = {
  type: string;
  essence: string;
  charset?: string;
};

let parseCharset = (parameters: string[]) => {
  for (let parameter of parameters) {
    let separator = parameter.indexOf('=');
    if (separator == -1) continue;
    if (parameter.slice(0, separator).trim().toLowerCase() != 'charset') continue;

    let value = parameter
      .slice(separator + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .toLowerCase();

    return charsetPattern.test(value) ? value : undefined;
  }
};

export let parseMediaType = (value?: string | null): ParsedMediaType | null => {
  if (typeof value != 'string') return null;

  let [rawEssence, ...parameters] = value.split(';');
  let essence = rawEssence!.trim().toLowerCase();
  let [type, subtype, ...rest] = essence.split('/');

  if (!type || !subtype || rest.length) return null;
  if (!mediaTypeTokenPattern.test(type) || !mediaTypeTokenPattern.test(subtype)) return null;

  return { type, essence, charset: parseCharset(parameters) };
};

export let serializeMediaType = (mediaType: ParsedMediaType) =>
  mediaType.charset ? `${mediaType.essence}; charset=${mediaType.charset}` : mediaType.essence;

export let getServedContentType = (contentType?: string | null) => {
  let mediaType = parseMediaType(contentType);
  return mediaType?.type == 'image' ? serializeMediaType(mediaType) : octetStreamMediaType;
};

export let getDocumentContentType = (contentType?: string | null) => {
  if (!contentType) return defaultDocumentContentType;

  let mediaType = parseMediaType(contentType);
  if (!mediaType) return octetStreamMediaType;
  if (mediaType.essence == octetStreamMediaType) return defaultDocumentContentType;

  return serializeMediaType(mediaType);
};

export let isPassiveMediaType = (contentType: string) => {
  let mediaType = parseMediaType(contentType);
  return !!mediaType && passiveMediaTypes.has(mediaType.essence);
};

export let getDirectUploadFileType = (fileType?: string | null) => {
  let value = fileType?.trim();
  if (!value) return undefined;

  let mediaType = parseMediaType(value);
  if (!mediaType) return octetStreamMediaType;

  return singleValuePattern.test(value) ? value : serializeMediaType(mediaType);
};
