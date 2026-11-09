import { afterEach, describe, expect, it } from 'vitest';
import { assertEdition, checkEdition, getEdition, isBuilt, perEdition } from '../src';

import { getReleaseChannel, checkReleaseChannel } from '../src';

afterEach(() => {
  delete process.env.METORIAL_RELEASE_CHANNEL;
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

describe('isBuilt', () => {
  it('is false when running from source', () => {
    expect(isBuilt()).toBe(false);
  });
});

describe('release channel runtime', () => {
  it('defaults to release', () => {
    expect(getReleaseChannel()).toBe('release');
    expect(checkReleaseChannel('dev')).toBe(false);
  });

  it('reads the source execution channel', () => {
    process.env.METORIAL_RELEASE_CHANNEL = 'dev';

    expect(getReleaseChannel()).toBe('dev');
    expect(checkReleaseChannel('dev')).toBe(true);
  });

  it('rejects invalid and empty channels', () => {
    for (let channel of ['nope', '']) {
      process.env.METORIAL_RELEASE_CHANNEL = channel;
      expect(() => getReleaseChannel()).toThrow('Unknown METORIAL_RELEASE_CHANNEL');
    }
  });
});
