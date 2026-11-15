import { describe, expect, it } from 'vitest';
import { mergeCoverage } from './persistJob';

describe('mergeCoverage', () => {
  it('keeps the weaker coverage of the two', () => {
    expect(mergeCoverage('full', 'sampled')).toBe('sampled');
    expect(mergeCoverage('sampled', 'full')).toBe('sampled');
    expect(mergeCoverage('partial', 'sampled')).toBe('partial');
    expect(mergeCoverage('skipped', 'full')).toBe('skipped');
    expect(mergeCoverage('full', 'skipped')).toBe('skipped');
    expect(mergeCoverage('full', 'full')).toBe('full');
  });

  it('takes the new coverage when nothing was recorded yet', () => {
    expect(mergeCoverage(null, 'partial')).toBe('partial');
    expect(mergeCoverage(undefined, 'full')).toBe('full');
  });
});
