import { describe, expect, it } from 'bun:test';
import {
  getSlatePackEntryPath,
  parseSlatePackManifest,
  parseSlatePackSignatures,
  serializeSlatePackSignatures
} from './format';

let channel = {
  url: 'https://slates.metorial-enterprise.com',
  subRegistryId: 'metorial-saas-prod'
};

let manifest = {
  format: 'metorial-slatepack',
  formatVersion: 1,
  createdAt: '2026-11-12T00:00:00.000Z',
  source: {
    url: 'https://slates.metorial-enterprise.com',
    subRegistryId: 'metorial-saas-prod'
  },
  entries: [
    {
      identifier: 'metorial/example',
      version: '1.0.0',
      path: 'entries/metorial/example/1.0.0.zip',
      contentChecksum: `sha256:${'a'.repeat(64)}`,
      signatures: [{ kid: 'k'.repeat(43), signature: 's'.repeat(86) }],
      catalog: { name: 'Example', description: null }
    }
  ]
};

describe('slate pack manifest', () => {
  it('parses a valid manifest and fills defaults', () => {
    let parsed = parseSlatePackManifest(JSON.stringify(manifest));

    expect(parsed.entries[0]!.catalog).toEqual({
      name: 'Example',
      description: null,
      logoUrl: null
    });
    expect(parsed.source.subRegistryId).toBe('metorial-saas-prod');
    expect(parsed.delivery).toBeNull();
  });

  it('ignores delivery on version 1 manifests', () => {
    let parsed = parseSlatePackManifest(
      JSON.stringify({ ...manifest, delivery: { kind: 'incremental', channel, sequence: 4 } })
    );

    expect(parsed.delivery).toBeNull();
  });

  it('parses incremental and full delivery on version 2 manifests', () => {
    let incremental = parseSlatePackManifest(
      JSON.stringify({
        ...manifest,
        formatVersion: 2,
        delivery: { kind: 'incremental', channel, sequence: 4 }
      })
    );
    let full = parseSlatePackManifest(
      JSON.stringify({
        ...manifest,
        formatVersion: 2,
        delivery: {
          kind: 'full',
          channel,
          fullSyncId: '202611130000',
          part: 2,
          partCount: 3,
          coversSequence: 41
        }
      })
    );

    expect(incremental.delivery).toEqual({ kind: 'incremental', channel, sequence: 4 });
    expect(full.delivery).toEqual({
      kind: 'full',
      channel,
      fullSyncId: '202611130000',
      part: 2,
      partCount: 3,
      coversSequence: 41
    });
  });

  it('rejects invalid delivery', () => {
    let withDelivery = (delivery: unknown) =>
      JSON.stringify({ ...manifest, formatVersion: 2, delivery });
    let full = {
      kind: 'full',
      channel,
      fullSyncId: '202611130000',
      part: 1,
      partCount: 1,
      coversSequence: 0
    };

    expect(() =>
      parseSlatePackManifest(withDelivery({ kind: 'incremental', channel, sequence: 0 }))
    ).toThrow();
    expect(() => parseSlatePackManifest(withDelivery({ ...full, part: 2 }))).toThrow();
    expect(() =>
      parseSlatePackManifest(withDelivery({ ...full, coversSequence: -1 }))
    ).toThrow();
    expect(() =>
      parseSlatePackManifest(withDelivery({ ...full, fullSyncId: '../x' }))
    ).toThrow();
  });

  it('round trips signatures and rejects malformed ones', () => {
    let signatures = [{ kid: 'k'.repeat(43), signature: 's'.repeat(86) }];

    expect(parseSlatePackSignatures(serializeSlatePackSignatures(signatures))).toEqual(
      signatures
    );
    expect(() => parseSlatePackSignatures('{')).toThrow();
    expect(() =>
      parseSlatePackSignatures(JSON.stringify({ format: 'other', signatures }))
    ).toThrow();
  });

  it('rejects other formats and invalid json', () => {
    expect(() => parseSlatePackManifest('{')).toThrow();
    expect(() =>
      parseSlatePackManifest(JSON.stringify({ ...manifest, format: 'other' }))
    ).toThrow();
    expect(() =>
      parseSlatePackManifest(JSON.stringify({ ...manifest, formatVersion: 3 }))
    ).toThrow();
  });

  it('builds entry paths without the @ prefix', () => {
    expect(getSlatePackEntryPath({ identifier: '@metorial/example', version: '1.0.0' })).toBe(
      'entries/metorial/example/1.0.0.zip'
    );
  });
});
