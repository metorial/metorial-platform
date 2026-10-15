export type FileSystemErrorCode =
  | 'not_found'
  | 'permission_denied'
  | 'already_exists'
  | 'not_a_directory'
  | 'not_a_file'
  | 'not_empty'
  | 'invalid_path'
  | 'disconnected'
  | 'cancelled'
  | 'unknown';

let knownCodes: FileSystemErrorCode[] = [
  'not_found',
  'permission_denied',
  'already_exists',
  'not_a_directory',
  'not_a_file',
  'not_empty',
  'invalid_path',
  'disconnected',
  'cancelled',
  'unknown'
];

export class FileSystemError extends Error {
  code: FileSystemErrorCode;

  constructor(code: FileSystemErrorCode, message?: string) {
    super(message ?? code.replace(/_/g, ' '));
    this.name = 'FileSystemError';
    this.code = code;
  }
}

export let getFileSystemErrorCode = (error: unknown): FileSystemErrorCode => {
  if (error instanceof FileSystemError) return error.code;
  if (!error || typeof error != 'object') return 'unknown';

  let code = (error as { code?: unknown }).code;
  if (typeof code == 'string' && knownCodes.includes(code as FileSystemErrorCode)) {
    return code as FileSystemErrorCode;
  }

  if ((error as { name?: unknown }).name == 'AbortError') return 'cancelled';

  return 'unknown';
};

export let isAbortError = (error: unknown) => getFileSystemErrorCode(error) == 'cancelled';

let getRawMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error == 'string' && error) return error;

  return null;
};

export interface FileSystemErrorDescription {
  code: FileSystemErrorCode;
  title: string;
  message: string;
}

export let describeFileSystemError = (
  error: unknown,
  context: { path?: string } = {}
): FileSystemErrorDescription => {
  let code = getFileSystemErrorCode(error);
  let target = context.path ?? 'This item';
  let raw = getRawMessage(error);

  if (code == 'not_found') {
    return { code, title: 'Not Found', message: `${target} doesn't exist.` };
  }

  if (code == 'permission_denied') {
    return {
      code,
      title: 'Permission Denied',
      message: `You don't have permission to access ${target}.`
    };
  }

  if (code == 'disconnected') {
    return {
      code,
      title: 'Disconnected',
      message: 'The connection to the file system was lost.'
    };
  }

  if (code == 'not_a_directory') {
    return { code, title: 'Not a Folder', message: `${target} isn't a folder.` };
  }

  if (code == 'already_exists') {
    return { code, title: 'Already Exists', message: `${target} already exists.` };
  }

  if (code == 'not_empty') {
    return { code, title: 'Folder Not Empty', message: `${target} isn't empty.` };
  }

  return {
    code,
    title: 'Something Went Wrong',
    message: raw ?? 'The file system returned an unexpected error.'
  };
};
