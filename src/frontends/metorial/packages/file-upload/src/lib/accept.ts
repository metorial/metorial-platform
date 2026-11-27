import { formatFileSize } from './formatFileSize';

export type FileRejectionReason = 'type' | 'size' | 'count';

export interface FileRejection {
  file: File | null;
  reason: FileRejectionReason;
  message: string;
}

let isExtension = (pattern: string) => pattern.startsWith('.');

let normalizePattern = (pattern: string) => pattern.trim().toLowerCase();

export let matchesAccept = (file: { name: string; type: string }, accept?: string[]) => {
  if (!accept?.length) return true;

  let name = file.name.toLowerCase();
  let type = file.type.toLowerCase();

  return accept.map(normalizePattern).some(pattern => {
    if (!pattern) return false;
    if (isExtension(pattern)) return name.endsWith(pattern) && name.length > pattern.length;
    if (pattern.endsWith('/*')) return type.startsWith(pattern.slice(0, -1));

    return type == pattern;
  });
};

export let toAcceptAttribute = (accept?: string[]) =>
  accept?.length ? accept.map(normalizePattern).join(',') : undefined;

let joinWithOr = (items: string[]) => {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
};

export let describeAccept = (accept?: string[]) => {
  if (!accept?.length) return null;

  let extensions = accept.map(normalizePattern).filter(isExtension);
  if (extensions.length) return joinWithOr(extensions);

  return joinWithOr(accept.map(normalizePattern));
};

export let describeMaxSize = (maxSize?: number) =>
  maxSize ? `Up to ${formatFileSize(maxSize)}` : null;

export let validateFile = (
  file: File,
  opts: { accept?: string[]; maxSize?: number }
): FileRejection | null => {
  if (!matchesAccept(file, opts.accept)) {
    let allowed = describeAccept(opts.accept);

    return {
      file,
      reason: 'type',
      message: allowed
        ? `${file.name} isn't a supported file. Use ${allowed}.`
        : `${file.name} isn't a supported file.`
    };
  }

  if (opts.maxSize != undefined && file.size > opts.maxSize) {
    return {
      file,
      reason: 'size',
      message: `${file.name} is ${formatFileSize(file.size)}. ${describeMaxSize(opts.maxSize)}.`
    };
  }

  return null;
};

export let splitFiles = (
  files: File[],
  opts: { accept?: string[]; maxSize?: number; multiple?: boolean }
) => {
  if (opts.multiple === false && files.length > 1) {
    return {
      accepted: [] as File[],
      rejected: [
        { file: null, reason: 'count', message: 'Choose one file.' }
      ] as FileRejection[]
    };
  }

  let accepted: File[] = [];
  let rejected: FileRejection[] = [];

  for (let file of files) {
    let rejection = validateFile(file, opts);

    if (rejection) rejected.push(rejection);
    else accepted.push(file);
  }

  return { accepted, rejected };
};
