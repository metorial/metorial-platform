import { describe, expect, it } from 'vitest';
import { fetchBuildManifest } from './fetchBuildManifest';

describe('fetchBuildManifest', () => {
  it('returns the parsed manifest', async () => {
    let result = await fetchBuildManifest(async () =>
      Buffer.from(JSON.stringify({ hash: 'abc' }))
    );

    expect(result).toEqual({ success: true, value: { hash: 'abc' } });
  });

  it('fails without throwing when the manifest is not JSON', async () => {
    let result = await fetchBuildManifest(async () => Buffer.from('<html>error</html>'));

    expect(result).toEqual({ success: false, reason: 'the manifest is not valid JSON' });
  });

  it('fails without throwing when reading the manifest throws', async () => {
    let result = await fetchBuildManifest(async () => {
      throw new Error('object not found');
    });

    expect(result).toEqual({
      success: false,
      reason: 'reading the manifest failed: object not found'
    });
  });
});
