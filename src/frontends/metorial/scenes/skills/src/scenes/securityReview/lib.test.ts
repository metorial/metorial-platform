import { describe, expect, it } from 'vitest';
import { isNearDuplicateText } from './lib';

describe('isNearDuplicateText', () => {
  it('treats text differing only in case and punctuation as a duplicate', () => {
    expect(
      isNearDuplicateText('Built and Operated by Metorial', 'Built and operated by Metorial.')
    ).toBe(true);
  });

  it('keeps text that adds substantial detail', () => {
    expect(
      isNearDuplicateText(
        'Third-Party Server',
        'The server is hosted by a third party that does not match the listed vendor domain.'
      )
    ).toBe(false);
  });

  it('never treats empty text as a duplicate', () => {
    expect(isNearDuplicateText('Uploaded Archive', '')).toBe(false);
  });
});
