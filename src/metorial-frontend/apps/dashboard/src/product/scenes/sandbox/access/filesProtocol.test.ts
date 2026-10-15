import { describe, expect, it } from 'vitest';
import {
  createFilesError,
  createFilesOperationId,
  decodeFilesChunk,
  encodeFilesCancel,
  encodeFilesChunk,
  encodeFilesRequest,
  encodeFilesWriteEnd,
  getFilesBasename,
  isValidFilesId,
  joinFilesPath,
  normalizeFilesPath,
  parseFilesMessage,
  sha256Hex,
  toFileEntry
} from './filesProtocol';

let encoder = new TextEncoder();
let decoder = new TextDecoder();

describe('files request encoding', () => {
  it('encodes an operation with its fields', () => {
    expect(
      JSON.parse(
        encodeFilesRequest('op1', 'list', { path: '/app', limit: 100, extra: undefined })
      )
    ).toEqual({ id: 'op1', op: 'list', path: '/app', limit: 100 });
  });

  it('encodes cancel and write end frames', () => {
    expect(JSON.parse(encodeFilesCancel('c1', 'op1'))).toEqual({
      id: 'c1',
      op: 'cancel',
      target: 'op1'
    });

    expect(JSON.parse(encodeFilesWriteEnd('op1', 'abc123'))).toEqual({
      id: 'op1',
      type: 'end',
      sha256: 'abc123'
    });

    expect(JSON.parse(encodeFilesWriteEnd('op1'))).toEqual({ id: 'op1', type: 'end' });
  });

  it('creates ids the server accepts', () => {
    let ids = new Set(Array.from({ length: 200 }, () => createFilesOperationId()));

    expect(ids.size).toBe(200);
    for (let id of ids) expect(isValidFilesId(id)).toBe(true);

    expect(isValidFilesId('')).toBe(false);
    expect(isValidFilesId('has space')).toBe(false);
    expect(isValidFilesId('a'.repeat(65))).toBe(false);
  });
});

describe('binary frames', () => {
  it('prefixes the payload with the id length and id', () => {
    let frame = encodeFilesChunk('w1', new Uint8Array([7, 8, 9]));

    expect(Array.from(frame)).toEqual([2, 119, 49, 7, 8, 9]);
  });

  it('round trips through decode', () => {
    let frame = encodeFilesChunk('read-1', encoder.encode('hello'));
    let decoded = decodeFilesChunk(frame.buffer);

    expect(decoded?.id).toBe('read-1');
    expect(decoder.decode(decoded!.data)).toBe('hello');
  });

  it('decodes views with an offset into a larger buffer', () => {
    let frame = encodeFilesChunk('a', new Uint8Array([1, 2]));
    let padded = new Uint8Array(frame.length + 4);
    padded.set(frame, 4);

    let decoded = decodeFilesChunk(padded.subarray(4));

    expect(decoded?.id).toBe('a');
    expect(Array.from(decoded!.data)).toEqual([1, 2]);
  });

  it('rejects malformed headers', () => {
    expect(decodeFilesChunk(new Uint8Array([]))).toBeNull();
    expect(decodeFilesChunk(new Uint8Array([0, 1, 2]))).toBeNull();
    expect(decodeFilesChunk(new Uint8Array([9, 97]))).toBeNull();
    expect(decodeFilesChunk(new Uint8Array([2, 32, 33, 1]))).toBeNull();
  });

  it('accepts a frame without payload', () => {
    expect(decodeFilesChunk(encodeFilesChunk('x', new Uint8Array(0)))?.data.length).toBe(0);
  });
});

describe('parseFilesMessage', () => {
  it('parses read starts', () => {
    expect(
      parseFilesMessage(
        '{"id":"r1","type":"start","size":10,"mtime":1700000000000,"offset":2}'
      )
    ).toEqual({
      type: 'start',
      id: 'r1',
      size: 10,
      modifiedAt: new Date(1700000000000),
      offset: 2
    });
  });

  it('parses entry batches and results', () => {
    expect(
      parseFilesMessage('{"id":"l1","type":"entries","entries":[{"name":"a","type":"file"}]}')
    ).toEqual({ type: 'entries', id: 'l1', entries: [{ name: 'a', type: 'file' }] });

    expect(
      parseFilesMessage('{"id":"l1","type":"result","count":1,"truncated":true}')
    ).toEqual({
      type: 'result',
      id: 'l1',
      fields: { count: 1, truncated: true }
    });
  });

  it('parses nested errors with their details', () => {
    let message = parseFilesMessage(
      '{"id":"s1","type":"error","error":{"code":"permission_denied","message":"denied","path":"/root","retryable":true}}'
    );

    expect(message).toMatchObject({ type: 'error', id: 's1' });
    if (message?.type != 'error') throw new Error('expected an error');

    expect(message.error).toMatchObject({
      code: 'permission_denied',
      serverCode: 'permission_denied',
      message: 'denied',
      path: '/root',
      retryable: true
    });
  });

  it('keeps connection level errors without an id', () => {
    let message = parseFilesMessage(
      '{"id":null,"type":"error","error":{"code":"invalid_request","message":"bad"}}'
    );

    expect(message).toMatchObject({ type: 'error', id: null });
  });

  it('passes connection notices through and ignores noise', () => {
    expect(parseFilesMessage('{"type":"connection_notice","notice":"closing"}')).toMatchObject(
      {
        type: 'connection_notice',
        notice: 'closing'
      }
    );

    expect(parseFilesMessage('not json')).toBeNull();
    expect(parseFilesMessage('{"id":"x","type":"mystery"}')).toBeNull();
    expect(parseFilesMessage('{"type":"result"}')).toBeNull();
  });
});

describe('createFilesError', () => {
  it('maps server codes to the codes the file browser understands', () => {
    let codes = [
      ['not_found', 'not_found'],
      ['permission_denied', 'permission_denied'],
      ['already_exists', 'already_exists'],
      ['not_a_directory', 'not_a_directory'],
      ['not_a_file', 'not_a_file'],
      ['is_a_directory', 'not_a_file'],
      ['not_empty', 'not_empty'],
      ['invalid_path', 'invalid_path'],
      ['cancelled', 'cancelled'],
      ['connection_interrupted', 'disconnected'],
      ['io_error', 'unknown'],
      ['something_new', 'unknown']
    ];

    for (let [serverCode, code] of codes) {
      expect(createFilesError({ code: serverCode, message: 'x' }).code).toBe(code);
    }
  });

  it('replaces cryptic messages for common failures', () => {
    expect(createFilesError({ code: 'no_space', message: 'os error 28' }).message).toBe(
      'There is no space left on the disk.'
    );

    expect(createFilesError({ code: 'read_only', message: 'os error 30' }).message).toBe(
      'The file system is read-only.'
    );

    expect(createFilesError({ code: 'io_error', message: 'boom' }).message).toBe('boom');
  });

  it('marks only server flagged errors as retryable', () => {
    expect(createFilesError({ code: 'io_error' }).retryable).toBe(false);
    expect(createFilesError({ code: 'io_error', retryable: true }).retryable).toBe(true);
  });
});

describe('paths and entries', () => {
  it('normalizes paths lexically', () => {
    expect(normalizeFilesPath('/a/./b/../c//d/')).toBe('/a/c/d');
    expect(normalizeFilesPath('/../..')).toBe('/');
    expect(normalizeFilesPath('relative/path')).toBe('/relative/path');
    expect(normalizeFilesPath('')).toBe('/');
  });

  it('joins and names paths', () => {
    expect(joinFilesPath('/', 'etc')).toBe('/etc');
    expect(joinFilesPath('/app/', 'src')).toBe('/app/src');
    expect(getFilesBasename('/app/src/server.ts')).toBe('server.ts');
    expect(getFilesBasename('/')).toBe('/');
  });

  it('maps list entries relative to their folder', () => {
    expect(
      toFileEntry(
        { name: 'server.ts', type: 'file', size: 42, mode: 0o644, mtime: 1700000000000 },
        '/app'
      )
    ).toEqual({
      name: 'server.ts',
      path: '/app/server.ts',
      type: 'file',
      size: 42,
      mode: 0o644,
      modifiedAt: new Date(1700000000000)
    });
  });

  it('maps stat entries with their own path and symlink target', () => {
    expect(
      toFileEntry({
        path: '/bin',
        type: 'symlink',
        size: 7,
        mode: 0o777,
        mtime: 0,
        target: 'usr/bin'
      })
    ).toEqual({
      name: 'bin',
      path: '/bin',
      type: 'symlink',
      size: 7,
      mode: 0o777,
      target: 'usr/bin'
    });
  });

  it('falls back to other for unknown entry types', () => {
    expect(toFileEntry({ name: 'sock', type: 'socket' }, '/tmp').type).toBe('other');
  });
});

describe('sha256Hex', () => {
  it('matches the known digest of abc', async () => {
    expect(await sha256Hex(encoder.encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});
