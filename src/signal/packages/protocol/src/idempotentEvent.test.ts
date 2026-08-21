import { describe, expect, it } from 'vitest';
import {
  AmbiguousCanonicalHeadersError,
  computeIdempotentEventRequestFingerprintV1,
  normalizeIdempotentEventDestinations,
  normalizeIdempotentEventHeaders,
  normalizeIdempotentEventTopics
} from './idempotentEvent';

let request = {
  tenantId: 'tenant-a',
  senderId: 'sender-a',
  topics: ['users', 'orders', 'orders'],
  eventType: 'created',
  payloadJson: '{"z":1, "a":2}',
  headers: { 'X-Z': '2', 'x-a': '1' },
  onlyForDestinations: ['dest-b', 'dest-a', 'dest-a'],
  callbackId: 'callback-a',
  callbackInstanceId: 'instance-a',
  callbackSourceId: 'source-a',
  callbackTriggerId: 'trigger-a'
};

describe('Signal idempotent event request protocol v1', () => {
  it('pins the shared request fingerprint vector', () => {
    expect(computeIdempotentEventRequestFingerprintV1(request)).toBe(
      'bcfe0b247b0e8d7b48047b84b08236c8c9416164c1d6a45d131972b4c1d50617'
    );
  });

  it('sorts and deduplicates topics and destination filters', () => {
    expect(normalizeIdempotentEventTopics(request.topics)).toEqual(['orders', 'users']);
    expect(normalizeIdempotentEventDestinations(request.onlyForDestinations)).toEqual([
      'dest-a',
      'dest-b'
    ]);
    expect(normalizeIdempotentEventDestinations(undefined)).toBeUndefined();
    expect(
      computeIdempotentEventRequestFingerprintV1({
        ...request,
        topics: ['orders', 'users'],
        onlyForDestinations: ['dest-a', 'dest-b']
      })
    ).toBe(computeIdempotentEventRequestFingerprintV1(request));
  });

  it('distinguishes an absent destination filter from an explicitly empty filter', () => {
    expect(
      computeIdempotentEventRequestFingerprintV1({
        ...request,
        onlyForDestinations: undefined
      })
    ).not.toBe(
      computeIdempotentEventRequestFingerprintV1({
        ...request,
        onlyForDestinations: []
      })
    );
  });

  it('case-normalizes and sorts unambiguous headers', () => {
    expect(normalizeIdempotentEventHeaders(request.headers)).toEqual({
      'x-a': '1',
      'x-z': '2'
    });
    expect(
      computeIdempotentEventRequestFingerprintV1({
        ...request,
        headers: { 'x-a': '1', 'x-z': '2' }
      })
    ).toBe(computeIdempotentEventRequestFingerprintV1(request));
  });

  it('rejects ambiguous case-normalized headers', () => {
    expect(() => normalizeIdempotentEventHeaders({ 'X-Test': 'a', 'x-test': 'b' })).toThrow(
      AmbiguousCanonicalHeadersError
    );
  });

  it('preserves payload JSON as exact UTF-8 bytes', () => {
    expect(
      computeIdempotentEventRequestFingerprintV1({
        ...request,
        payloadJson: '{"a":2,"z":1}'
      })
    ).not.toBe(computeIdempotentEventRequestFingerprintV1(request));
  });

  it.each([
    ['tenantId', 'tenant-b'],
    ['senderId', 'sender-b'],
    ['eventType', 'updated'],
    ['callbackId', 'callback-b'],
    ['callbackInstanceId', 'instance-b'],
    ['callbackSourceId', 'source-b'],
    ['callbackTriggerId', 'trigger-b']
  ])('binds %s independently', (field, value) => {
    expect(
      computeIdempotentEventRequestFingerprintV1({ ...request, [field]: value })
    ).not.toBe(computeIdempotentEventRequestFingerprintV1(request));
  });
});
