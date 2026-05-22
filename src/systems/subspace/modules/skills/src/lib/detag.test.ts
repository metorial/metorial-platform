import { describe, expect, it } from 'vitest';
import { detag } from './detag';

describe('detag', () => {
  it('dedents multiline template strings', () => {
    let result = detag`
      line one
        line two
    `;

    expect(result).toBe('line one\n  line two');
  });
});
