import { describe, expect, it } from 'vitest';
import { mergeClassification } from '../src/lib/settings';

describe('mergeClassification', () => {
  it('changes only the switches it is given', () => {
    expect(
      mergeClassification(
        { enabled: true, threshold: 0.9, ai: { enabled: false, model: 'clef-flash' } },
        { enabled: false, ai: { enabled: true } }
      )
    ).toEqual({ enabled: false, threshold: 0.9, ai: { enabled: true, model: 'clef-flash' } });
  });

  it('leaves the settings alone without a change', () => {
    expect(mergeClassification({ enabled: true }, undefined)).toBeUndefined();
  });
});
