import { VersionedEncryptionKeyring } from '@lowerdeck/encryption';
import { SLATE_WEBHOOK_WIRE_CONFORMANCE_FIXTURES_V1 } from '@slates/proto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({ db: {} }));
vi.mock('../queues/trigger/webhook', () => ({
  slateTriggerWebhookQueue: { add: vi.fn() }
}));
import { createWebhookRequestPayloadCrypto } from '../services/slateTriggerWebhookRequest';
import {
  computeWebhookWireBodyHash,
  computeWebhookWireRequestHash,
  deserializeWebhookWireRequest,
  encodeWebhookWireRequest,
  serializeWebhookWireRequest,
  type WebhookWireRequest
} from './webhookWire';

let wire: WebhookWireRequest = {
  url: 'https://hooks.test/inbound?token=one&token=two',
  method: 'POST',
  headers: [
    ['X-Mixed', 'one'],
    ['x-mixed', 'two,three']
  ],
  body: { present: true, base64: Buffer.from([0, 255, 1]).toString('base64') }
};

describe('WebhookWireRequest canonical encoding', () => {
  it.each(SLATE_WEBHOOK_WIRE_CONFORMANCE_FIXTURES_V1)(
    'matches shared $name fixture bytes and request hash',
    fixture => {
      expect(Buffer.from(encodeWebhookWireRequest(fixture.request)).toString('base64')).toBe(
        fixture.canonicalBase64
      );
      expect(computeWebhookWireRequestHash(fixture.request)).toBe(fixture.requestHash);
    }
  );

  it('round-trips canonical tuples and binary bytes with both stable hashes', () => {
    expect(deserializeWebhookWireRequest(serializeWebhookWireRequest(wire))).toEqual(wire);
    expect(computeWebhookWireRequestHash(wire)).toMatch(/^[a-f0-9]{64}$/);
    expect(computeWebhookWireBodyHash(wire)).toMatch(/^[a-f0-9]{64}$/);
    expect(
      computeWebhookWireRequestHash({ ...wire, headers: [...wire.headers].reverse() })
    ).not.toBe(computeWebhookWireRequestHash(wire));
  });

  it('distinguishes absent from present-empty bodies', () => {
    let absent = { ...wire, body: { present: false as const } };
    let empty = { ...wire, body: { present: true as const, base64: '' } };
    expect(computeWebhookWireRequestHash(absent)).not.toBe(
      computeWebhookWireRequestHash(empty)
    );
    expect(computeWebhookWireBodyHash(absent)).not.toBe(computeWebhookWireBodyHash(empty));
  });

  it('rejects wrong tenant, receiver, request, and swapped AAD bindings', async () => {
    let keyring = new VersionedEncryptionKeyring({
      keys: { 1: 'test-key-one', 2: 'test-key-two' },
      activeKeyVersion: 2,
      supportedAadVersions: [1]
    });
    let crypto = createWebhookRequestPayloadCrypto(keyring);
    let encrypted = await crypto.encrypt({
      tenantId: 'tenant-1',
      receiverId: 'receiver-1',
      requestId: 'request-1',
      request: wire
    });
    await expect(
      crypto.decrypt({
        tenantId: 'tenant-1',
        receiverId: 'receiver-1',
        requestId: 'request-1',
        ...encrypted
      })
    ).resolves.toEqual(wire);
    for (let binding of [
      { tenantId: 'tenant-2', receiverId: 'receiver-1', requestId: 'request-1' },
      { tenantId: 'tenant-1', receiverId: 'receiver-2', requestId: 'request-1' },
      { tenantId: 'tenant-1', receiverId: 'receiver-1', requestId: 'request-2' }
    ]) {
      await expect(crypto.decrypt({ ...binding, ...encrypted })).rejects.toBeTruthy();
    }
  });
});
