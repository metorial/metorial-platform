import { describe, expect, it } from 'bun:test';
import { getSlatePackEntryPath, parseSlatePackManifest } from './format';

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
  });

  it('rejects other formats and invalid json', () => {
    expect(() => parseSlatePackManifest('{')).toThrow();
    expect(() =>
      parseSlatePackManifest(JSON.stringify({ ...manifest, format: 'other' }))
    ).toThrow();
    expect(() =>
      parseSlatePackManifest(JSON.stringify({ ...manifest, formatVersion: 2 }))
    ).toThrow();
  });

  it('builds entry paths without the @ prefix', () => {
    expect(getSlatePackEntryPath({ identifier: '@metorial/example', version: '1.0.0' })).toBe(
      'entries/metorial/example/1.0.0.zip'
    );
  });
});
