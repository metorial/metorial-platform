import { describe, expect, it } from 'vitest';
import {
  describeFileSystemError,
  FileSystemError,
  getFileSystemErrorCode,
  isAbortError
} from './errors';

describe('getFileSystemErrorCode', () => {
  it('reads the code from FileSystemError', () => {
    expect(getFileSystemErrorCode(new FileSystemError('permission_denied'))).toBe(
      'permission_denied'
    );
  });

  it('reads known codes from plain objects and errors', () => {
    expect(getFileSystemErrorCode({ code: 'not_found' })).toBe('not_found');

    let error = Object.assign(new Error('boom'), { code: 'disconnected' });
    expect(getFileSystemErrorCode(error)).toBe('disconnected');
  });

  it('maps abort errors to cancelled', () => {
    let error = new Error('aborted');
    error.name = 'AbortError';

    expect(getFileSystemErrorCode(error)).toBe('cancelled');
    expect(isAbortError(error)).toBe(true);
  });

  it('falls back to unknown', () => {
    expect(getFileSystemErrorCode({ code: 'ENOENT' })).toBe('unknown');
    expect(getFileSystemErrorCode('nope')).toBe('unknown');
    expect(getFileSystemErrorCode(null)).toBe('unknown');
  });
});

describe('describeFileSystemError', () => {
  it('writes specific copy for known codes', () => {
    expect(describeFileSystemError(new FileSystemError('not_found'), { path: '/a' })).toEqual({
      code: 'not_found',
      title: 'Not Found',
      message: "/a doesn't exist."
    });

    expect(describeFileSystemError(new FileSystemError('permission_denied')).title).toBe(
      'Permission Denied'
    );

    expect(describeFileSystemError(new FileSystemError('disconnected')).message).toMatch(
      /connection/i
    );
  });

  it('uses the raw message for unknown errors', () => {
    expect(describeFileSystemError(new Error('Disk on fire'))).toMatchObject({
      code: 'unknown',
      message: 'Disk on fire'
    });
  });

  it('has a generic message when nothing is available', () => {
    expect(describeFileSystemError(undefined).message).toMatch(/unexpected/i);
  });
});
