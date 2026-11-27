import { describe, expect, it } from 'vitest';
import { neutralizeInternalTerms, neutralizeInternalTermsDeep } from './terminology';

describe('internal terminology', () => {
  it('replaces slate with integration, keeping case and plurals', () => {
    expect(neutralizeInternalTerms('This slate and Slates, SLATE.')).toBe(
      'This integration and Integrations, Integration.'
    );
  });

  it('leaves longer words alone', () => {
    expect(neutralizeInternalTerms('translate slated')).toBe('translate slated');
  });

  it('rewrites prose but not identifiers', () => {
    expect(
      neutralizeInternalTermsDeep({
        summary: { text: 'An integration.' },
        evidence: [{ type: 'file', path: '/evidence/slate.json', title: 'Slate file' }]
      })
    ).toEqual({
      summary: { text: 'An integration.' },
      evidence: [{ type: 'file', path: '/evidence/slate.json', title: 'Integration file' }]
    });
  });
});
