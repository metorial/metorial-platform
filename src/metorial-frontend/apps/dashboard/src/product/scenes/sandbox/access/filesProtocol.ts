import type { FileEntry, FileEntryType, FileSystemErrorCode } from '@metorial/file-browser';
import { isSandboxConnectionNotice, type SandboxConnectionNotice } from './common';

export let FILES_CHUNK_SIZE = 64 * 1024;
export let FILES_LIST_LIMIT = 10_000;

let MAX_ID_LENGTH = 64;

export type SandboxFilesErrorCode = FileSystemErrorCode;

export interface SandboxFilesErrorDetails {
  serverCode?: string;
  path?: string;
  retryable?: boolean;
}

export class SandboxFilesError extends Error {
  code: SandboxFilesErrorCode;
  serverCode?: string;
  path?: string;
  retryable: boolean;

  constructor(
    code: SandboxFilesErrorCode,
    message?: string,
    details: SandboxFilesErrorDetails = {}
  ) {
    super(message ?? code.replace(/_/g, ' '));
    this.name = 'SandboxFilesError';
    this.code = code;
    this.serverCode = details.serverCode;
    this.path = details.path;
    this.retryable = !!details.retryable;
  }
}

let serverErrorCodes: Record<string, SandboxFilesErrorCode> = {
  not_found: 'not_found',
  permission_denied: 'permission_denied',
  already_exists: 'already_exists',
  not_a_directory: 'not_a_directory',
  is_a_directory: 'not_a_file',
  not_a_file: 'not_a_file',
  not_empty: 'not_empty',
  invalid_path: 'invalid_path',
  cancelled: 'cancelled',
  connection_interrupted: 'disconnected'
};

let serverErrorMessages: Record<string, string> = {
  no_space: 'There is no space left on the disk.',
  read_only: 'The file system is read-only.',
  cross_device: 'This item cannot be moved to a different disk.',
  checksum_mismatch: 'The file was corrupted while uploading. Try again.',
  size_mismatch: 'The file changed while uploading. Try again.'
};

export let createFilesError = (raw: {
  code?: unknown;
  message?: unknown;
  path?: unknown;
  retryable?: unknown;
}) => {
  let serverCode = typeof raw.code == 'string' ? raw.code : 'unknown';
  let message = typeof raw.message == 'string' ? raw.message : undefined;

  return new SandboxFilesError(
    serverErrorCodes[serverCode] ?? 'unknown',
    serverErrorMessages[serverCode] ?? message,
    {
      serverCode,
      path: typeof raw.path == 'string' ? raw.path : undefined,
      retryable: raw.retryable === true
    }
  );
};

export type SandboxFilesOperation =
  | 'stat'
  | 'list'
  | 'read'
  | 'write'
  | 'delete'
  | 'mkdir'
  | 'move'
  | 'cancel';

export let encodeFilesRequest = (
  id: string,
  op: SandboxFilesOperation,
  fields: Record<string, unknown> = {}
) => JSON.stringify({ id, op, ...fields });

export let encodeFilesCancel = (id: string, target: string) =>
  encodeFilesRequest(id, 'cancel', { target });

export let encodeFilesWriteEnd = (id: string, sha256?: string) =>
  JSON.stringify({ id, type: 'end', ...(sha256 && { sha256 }) });

let encoder = new TextEncoder();
let decoder = new TextDecoder();

export let isValidFilesId = (id: string) =>
  /^[A-Za-z0-9_-]+$/.test(id) && id.length <= MAX_ID_LENGTH;

export let encodeFilesChunk = (id: string, data: Uint8Array) => {
  let idBytes = encoder.encode(id);
  let frame = new Uint8Array(1 + idBytes.length + data.length);

  frame[0] = idBytes.length;
  frame.set(idBytes, 1);
  frame.set(data, 1 + idBytes.length);

  return frame;
};

export let decodeFilesChunk = (frame: ArrayBuffer | ArrayBufferView) => {
  let bytes = ArrayBuffer.isView(frame)
    ? new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength)
    : new Uint8Array(frame);

  let idLength = bytes[0] ?? 0;
  if (!idLength || bytes.length < 1 + idLength) return null;

  let id = decoder.decode(bytes.subarray(1, 1 + idLength));
  if (!isValidFilesId(id)) return null;

  return { id, data: bytes.subarray(1 + idLength) };
};

let operationCounter = 0;

export let createFilesOperationId = () => {
  operationCounter = (operationCounter + 1) % 1_679_616;

  let time = Date.now().toString(36);
  let counter = operationCounter.toString(36).padStart(4, '0');
  let random = Math.random().toString(36).slice(2, 10);

  return `f${time}${counter}${random}`;
};

export interface SandboxFilesWireEntry {
  name?: string;
  path?: string;
  type?: string;
  size?: number;
  mode?: number;
  mtime?: number;
  target?: string;
}

export type SandboxFilesMessage =
  | { type: 'start'; id: string; size: number; modifiedAt: Date | undefined; offset: number }
  | { type: 'entries'; id: string; entries: SandboxFilesWireEntry[] }
  | { type: 'result'; id: string; fields: Record<string, any> }
  | { type: 'error'; id: string | null; error: SandboxFilesError }
  | SandboxConnectionNotice;

export let toModifiedAt = (mtime: unknown) =>
  typeof mtime == 'number' && mtime > 0 ? new Date(mtime) : undefined;

export let parseFilesMessage = (text: string): SandboxFilesMessage | null => {
  let message: unknown;

  try {
    message = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof message != 'object' || message === null) return null;
  if (isSandboxConnectionNotice(message)) return message;

  let raw = message as Record<string, any>;
  let id = typeof raw.id == 'string' ? raw.id : null;

  if (raw.type == 'error') {
    let error = typeof raw.error == 'object' && raw.error ? raw.error : raw;
    return { type: 'error', id, error: createFilesError(error) };
  }

  if (!id) return null;

  switch (raw.type) {
    case 'start':
      return {
        type: 'start',
        id,
        size: Number(raw.size) || 0,
        modifiedAt: toModifiedAt(raw.mtime),
        offset: Number(raw.offset) || 0
      };

    case 'entries':
      return { type: 'entries', id, entries: Array.isArray(raw.entries) ? raw.entries : [] };

    case 'result': {
      let { id: _id, type: _type, ...fields } = raw;
      return { type: 'result', id, fields };
    }

    default:
      return null;
  }
};

export let ROOT_PATH = '/';

export let normalizeFilesPath = (path: string) => {
  let parts: string[] = [];

  for (let part of path.split('/')) {
    if (!part || part == '.') continue;

    if (part == '..') parts.pop();
    else parts.push(part);
  }

  return ROOT_PATH + parts.join('/');
};

export let joinFilesPath = (parent: string, name: string) =>
  normalizeFilesPath(`${parent}/${name}`);

export let getFilesBasename = (path: string) => {
  let normalized = normalizeFilesPath(path);
  return normalized == ROOT_PATH
    ? ROOT_PATH
    : normalized.slice(normalized.lastIndexOf('/') + 1);
};

let entryTypes: FileEntryType[] = ['file', 'directory', 'symlink', 'other'];

export let toFileEntry = (wire: SandboxFilesWireEntry, parent?: string): FileEntry => {
  let path = wire.path ?? joinFilesPath(parent ?? ROOT_PATH, wire.name ?? '');
  let type = entryTypes.find(candidate => candidate == wire.type) ?? 'other';

  let entry: FileEntry = {
    name: wire.name ?? getFilesBasename(path),
    path: normalizeFilesPath(path),
    type,
    size: typeof wire.size == 'number' ? wire.size : 0
  };

  if (typeof wire.mode == 'number') entry.mode = wire.mode;

  let modifiedAt = toModifiedAt(wire.mtime);
  if (modifiedAt) entry.modifiedAt = modifiedAt;

  if (type == 'symlink' && wire.target) entry.target = wire.target;

  return entry;
};

let toHex = (bytes: Uint8Array) =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

export let sha256Hex = async (data: Uint8Array) => {
  let digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return toHex(new Uint8Array(digest));
};
