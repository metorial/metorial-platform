import { describe, expect, it, vi } from 'vitest';
import { grantablePlatformRoutes } from './platformRoutes';

vi.mock('../env', () => ({
  env: { egressGateway: { GRANTABLE_PLATFORM_ROUTES: ['slates-live', 'object-upload'] } }
}));

describe('grantablePlatformRoutes', () => {
  it('keeps only routes the installation lets invocations request', () => {
    expect(grantablePlatformRoutes(['slates-live', 'admin', 'object-upload'])).toEqual([
      'slates-live',
      'object-upload'
    ]);
  });

  it('drops duplicates', () => {
    expect(grantablePlatformRoutes(['slates-live', 'slates-live'])).toEqual(['slates-live']);
  });

  it('grants nothing when nothing grantable was requested', () => {
    expect(grantablePlatformRoutes(undefined)).toBeUndefined();
    expect(grantablePlatformRoutes([])).toBeUndefined();
    expect(grantablePlatformRoutes(['admin'])).toBeUndefined();
  });
});
