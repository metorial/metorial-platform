import { describe, expect, it } from 'vitest';
import { mergeClassification, mergeOrganizationSettings } from '../src/lib/settings';

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

describe('mergeOrganizationSettings', () => {
  it('changes only the Desktop settings it is given', () => {
    expect(
      mergeOrganizationSettings(
        {
          sliceErasureMode: 'delete',
          desktop: { toolDetails: true, sessionContext: false, sessionTitles: true }
        },
        { desktop: { sessionContext: true } }
      )
    ).toEqual({
      sliceErasureMode: 'delete',
      desktop: { toolDetails: true, sessionContext: true, sessionTitles: true }
    });
  });

  it('keeps the Desktop settings when a change leaves them out', () => {
    expect(
      mergeOrganizationSettings(
        { desktop: { historyImport: true } },
        { privacy: { hideIndividuals: true } }
      )
    ).toEqual({ desktop: { historyImport: true }, privacy: { hideIndividuals: true } });
  });
});
