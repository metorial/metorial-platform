import { describe, expect, it } from 'vitest';
import { mergeSettings, resolveInstanceSettings } from '../src/settings';

describe('mergeSettings', () => {
  it('keeps fields of a setting that the change leaves out', () => {
    let merged = mergeSettings(
      { contentLogging: { enabled: false, retentionDays: 30 }, fallbacks: { enabled: false } },
      { contentLogging: { enabled: true } }
    );

    expect(merged).toEqual({
      contentLogging: { enabled: true, retentionDays: 30 },
      fallbacks: { enabled: false }
    });
  });

  it('changes a single field without the rest of its setting', () => {
    let merged = mergeSettings(
      { contentLogging: { enabled: true } },
      { contentLogging: { retentionDays: 14 } }
    );

    expect(resolveInstanceSettings(merged).contentLogging).toEqual({
      enabled: true,
      retentionDays: 14
    });
  });

  it('ignores undefined changes', () => {
    let merged = mergeSettings(
      { zeroDataRetention: { required: true } },
      { zeroDataRetention: { required: undefined }, metorialProvider: undefined }
    );

    expect(merged).toEqual({ zeroDataRetention: { required: true } });
  });
});
