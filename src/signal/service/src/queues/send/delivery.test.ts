import { describe, expect, it } from 'vitest';
import { generateSignatures, parseMetorialSignature } from '../../lib/signature';

describe('Signal delivery signature ordering', () => {
  it('keeps active first and all selected retiring secrets deterministic', async () => {
    let first = await generateSignatures('payload', ['active', 'retiring-v3', 'retiring-v2'], {
      timestamp: 100
    });
    let second = await generateSignatures(
      'payload',
      ['active', 'retiring-v3', 'retiring-v2'],
      { timestamp: 100 }
    );
    expect(first).toBe(second);
    expect(parseMetorialSignature(first).signatures).toHaveLength(3);
  });
});
