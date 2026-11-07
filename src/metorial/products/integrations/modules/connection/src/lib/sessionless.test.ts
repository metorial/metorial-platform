import { describe, expect, it } from 'vitest';
import { isSessionlessMcpEnabled } from './sessionless';

describe('isSessionlessMcpEnabled', () => {
  it.each([
    [{ sessionlessMcpEnabled: null }, false],
    [{}, false],
    [{ sessionlessMcpEnabled: false }, false],
    [{ sessionlessMcpEnabled: true }, true]
  ])('resolves %j to %s', (configured, expected) => {
    expect(isSessionlessMcpEnabled(configured)).toBe(expected);
  });
});
