import { afterEach, describe, expect, it } from 'vitest';
import { assertEdition, checkEdition, getEdition, perEdition } from '../src';

afterEach(() => {
  delete process.env.METORIAL_EDITION;
});

describe('edition runtime', () => {
  it('defaults to cloud', () => {
    expect(getEdition()).toBe('cloud');
    expect(checkEdition('cloud')).toBe(true);
    expect(checkEdition('on-prem')).toBe(false);
  });

  it('reads METORIAL_EDITION', () => {
    process.env.METORIAL_EDITION = 'on-prem';

    expect(getEdition()).toBe('on-prem');
    expect(perEdition({ cloud: 'a', 'on-prem': 'b' })).toBe('b');
    expect(() => assertEdition('cloud')).toThrow('only available');
  });

  it('rejects unknown editions', () => {
    process.env.METORIAL_EDITION = 'nope';

    expect(() => getEdition()).toThrow('Unknown METORIAL_EDITION');
  });
});
