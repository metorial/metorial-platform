import { describe, expect, it } from 'vitest';
import { encodeExportResponse, otlpResponse } from '../response';
import { Reader } from '../reader';

let decodePartial = (bytes: Uint8Array) => {
  let root = new Reader(bytes);
  let result: { rejected?: number; message?: string; extraTopLevel: number } = {
    extraTopLevel: 0
  };

  while (root.next()) {
    if (root.field != 1 || root.wire != 2) {
      result.extraTopLevel++;
      root.skip();
      continue;
    }

    let partial = root.message();

    while (partial.next()) {
      if (partial.field == 1 && partial.wire == 0) result.rejected = partial.varintNumber();
      else if (partial.field == 2 && partial.wire == 2) result.message = partial.string();
      else partial.skip();
    }
  }

  return result;
};

describe('encodeExportResponse', () => {
  it('is empty without a partial success', () => {
    expect(encodeExportResponse('logs')).toEqual(new Uint8Array());
    expect(encodeExportResponse('logs', { rejected: 0 })).toEqual(new Uint8Array());
    expect(encodeExportResponse('logs', { rejected: -3, message: 'x' })).toEqual(
      new Uint8Array()
    );
  });

  it.each(['logs', 'metrics', 'traces'] as const)('encodes a %s partial success', signal => {
    let decoded = decodePartial(
      encodeExportResponse(signal, { rejected: 7, message: 'bad items' })
    );

    expect(decoded).toEqual({ rejected: 7, message: 'bad items', extraTopLevel: 0 });
  });

  it('omits the message when absent or empty', () => {
    expect(
      decodePartial(encodeExportResponse('logs', { rejected: 1 })).message
    ).toBeUndefined();
    expect(
      decodePartial(encodeExportResponse('logs', { rejected: 1, message: '' })).message
    ).toBeUndefined();
  });

  it('encodes large counts and multibyte messages', () => {
    let decoded = decodePartial(
      encodeExportResponse('metrics', { rejected: 20_000, message: 'héllo 😀' })
    );

    expect(decoded.rejected).toBe(20_000);
    expect(decoded.message).toBe('héllo 😀');
  });

  it('uses a multi-byte length prefix for long messages', () => {
    let message = 'x'.repeat(500);

    expect(decodePartial(encodeExportResponse('logs', { rejected: 2, message })).message).toBe(
      message
    );
  });

  it('truncates fractional counts', () => {
    expect(decodePartial(encodeExportResponse('logs', { rejected: 2.9 })).rejected).toBe(2);
  });
});

describe('otlpResponse', () => {
  it('returns an empty protobuf body on full success', async () => {
    let response = otlpResponse('logs', 'protobuf');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/x-protobuf');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array());
  });

  it('returns a decodable protobuf partial success', async () => {
    let response = otlpResponse('traces', 'protobuf', { rejected: 3, message: 'nope' });

    expect(decodePartial(new Uint8Array(await response.arrayBuffer()))).toEqual({
      rejected: 3,
      message: 'nope',
      extraTopLevel: 0
    });
  });

  it('returns an empty JSON object on full success', async () => {
    let response = otlpResponse('logs', 'json');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({});
  });

  it.each([
    ['logs', 'rejectedLogRecords'],
    ['metrics', 'rejectedDataPoints'],
    ['traces', 'rejectedSpans']
  ] as const)('names the JSON rejected count for %s', async (signal, field) => {
    let response = otlpResponse(signal, 'json', { rejected: 4, message: 'bad' });

    expect(await response.json()).toEqual({
      partialSuccess: { [field]: '4', errorMessage: 'bad' }
    });
  });

  it('omits the error message and ignores zero rejections in JSON', async () => {
    expect(await otlpResponse('logs', 'json', { rejected: 2 }).json()).toEqual({
      partialSuccess: { rejectedLogRecords: '2' }
    });
    expect(await otlpResponse('logs', 'json', { rejected: 0, message: 'x' }).json()).toEqual(
      {}
    );
  });
});
