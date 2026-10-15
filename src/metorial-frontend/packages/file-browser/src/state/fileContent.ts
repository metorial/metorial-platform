import { toBlobPart } from '../lib/download';
import { FileSystemError } from '../lib/errors';
import {
  looksLikeText,
  planPreview,
  TEXT_CHUNK_SIZE,
  type UnsupportedReason
} from '../lib/preview';
import {
  createTextChunkDecoder,
  detectLineEnding,
  encodeText,
  hasUtf8Bom,
  type LineEnding,
  type TextChunkDecoder
} from '../lib/text';
import type { FileEntry, FileSystemAdapter } from '../types';

export interface ReadOptions {
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
}

export interface FileBaseline {
  size: number;
  modifiedAt?: Date;
}

export interface TextPreview {
  kind: 'text';
  text: string;
  loadedBytes: number;
  size: number;
  complete: boolean;
  lineEnding: LineEnding;
  bom: boolean;
  baseline: FileBaseline;
  decoder: TextChunkDecoder;
}

export interface ImagePreview {
  kind: 'image';
  blob: Blob;
  mimeType: string;
}

export interface UnsupportedPreview {
  kind: 'unsupported';
  reason: UnsupportedReason;
}

export type LoadedPreview = TextPreview | ImagePreview | UnsupportedPreview;

let isComplete = (
  offset: number,
  received: number,
  requested: number | undefined,
  size: number
) => (requested != undefined && received < requested) || offset + received >= size;

export let loadPreview = async (
  adapter: FileSystemAdapter,
  entry: FileEntry,
  opts: ReadOptions = {}
): Promise<LoadedPreview> => {
  let plan = planPreview(entry);

  if (plan.kind == 'unsupported') return plan;

  if (plan.kind == 'image') {
    let result = await adapter.read(entry.path, opts);
    let blob = new Blob([toBlobPart(result.data)], { type: plan.mimeType });

    return { kind: 'image', blob, mimeType: plan.mimeType };
  }

  let requested = plan.partial ? TEXT_CHUNK_SIZE : undefined;
  let result = await adapter.read(entry.path, { ...opts, offset: 0, length: requested });

  if (!looksLikeText(result.data)) return { kind: 'unsupported', reason: 'binary' };

  let complete = isComplete(0, result.data.byteLength, requested, result.size);
  let decoder = createTextChunkDecoder();
  let text: string;

  try {
    text = decoder.decode(result.data, complete);
  } catch {
    return { kind: 'unsupported', reason: 'binary' };
  }

  return {
    kind: 'text',
    text,
    loadedBytes: result.data.byteLength,
    size: result.size,
    complete,
    lineEnding: detectLineEnding(text),
    bom: hasUtf8Bom(result.data),
    baseline: { size: result.size, modifiedAt: result.modifiedAt },
    decoder
  };
};

export let loadMoreText = async (
  adapter: FileSystemAdapter,
  path: string,
  preview: TextPreview,
  opts: ReadOptions = {}
): Promise<TextPreview> => {
  if (preview.complete) return preview;

  let result = await adapter.read(path, {
    ...opts,
    offset: preview.loadedBytes,
    length: TEXT_CHUNK_SIZE
  });

  let loadedBytes = preview.loadedBytes + result.data.byteLength;
  let complete = isComplete(
    preview.loadedBytes,
    result.data.byteLength,
    TEXT_CHUNK_SIZE,
    result.size
  );

  let chunk: string;

  try {
    chunk = preview.decoder.decode(result.data, complete);
  } catch {
    throw new FileSystemError('unknown', 'The rest of this file isn’t valid UTF-8 text.');
  }

  return {
    ...preview,
    text: preview.text + chunk,
    loadedBytes,
    size: result.size,
    complete
  };
};

export let hasChangedSince = (
  baseline: FileBaseline,
  current: Pick<FileEntry, 'size' | 'modifiedAt'>
) => {
  if (current.size != baseline.size) return true;
  if (!baseline.modifiedAt || !current.modifiedAt) return false;

  return current.modifiedAt.getTime() != baseline.modifiedAt.getTime();
};

export type SaveResult =
  | { status: 'saved'; entry: FileEntry }
  | { status: 'conflict'; current: FileEntry };

export let saveText = async (
  adapter: FileSystemAdapter,
  entry: FileEntry,
  preview: TextPreview,
  draft: string,
  opts: { force?: boolean; signal?: AbortSignal } = {}
): Promise<SaveResult> => {
  if (!preview.complete)
    throw new FileSystemError('unknown', 'Load the whole file before saving.');

  if (!opts.force) {
    let current = await adapter.stat(entry.path, { signal: opts.signal });
    if (hasChangedSince(preview.baseline, current)) return { status: 'conflict', current };
  }

  let data = encodeText(draft, { lineEnding: preview.lineEnding, bom: preview.bom });

  await adapter.write(entry.path, data, {
    overwrite: true,
    mode: entry.mode,
    signal: opts.signal
  });

  let saved = await adapter.stat(entry.path, { signal: opts.signal });

  return { status: 'saved', entry: { ...saved, name: entry.name } };
};
