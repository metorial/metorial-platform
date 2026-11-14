import { isServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import { assertManifestSyncAllowed } from './manifestSyncPolicy';

let settings = {
  ORIGIN_MANIFEST_SYNC_ENABLED: true,
  ORIGIN_MANIFEST_SOURCE_BUCKETS: ['mte-files']
};

let errorOf = (fn: () => void) => {
  try {
    fn();
  } catch (error) {
    if (isServiceError(error)) return error.data;
    throw error;
  }
  return undefined;
};

describe('manifest sync policy', () => {
  it('accepts allowlisted buckets', () => {
    expect(
      errorOf(() => assertManifestSyncAllowed(settings, ['mte-files', 'mte-files']))
    ).toBe(undefined);
  });

  it('rejects a bucket outside the allowlist', () => {
    expect(
      errorOf(() => assertManifestSyncAllowed(settings, ['mte-files', 'other']))
    ).toMatchObject({ status: 400 });
  });

  it('rejects everything when no bucket is allowlisted', () => {
    expect(
      errorOf(() =>
        assertManifestSyncAllowed({ ...settings, ORIGIN_MANIFEST_SOURCE_BUCKETS: [] }, [
          'mte-files'
        ])
      )
    ).toMatchObject({ status: 400 });
  });

  it('rejects with a non-retried 4xx while the kill switch is off', () => {
    let error = errorOf(() =>
      assertManifestSyncAllowed({ ...settings, ORIGIN_MANIFEST_SYNC_ENABLED: false }, [
        'mte-files'
      ])
    );

    expect(error).toMatchObject({ status: 409, code: 'manifest_sync_disabled' });
    expect(error!.status).toBeLessThan(500);
  });
});
