import { describe, expect, it } from 'vitest';
import { assertPortalAuthStateOrAllowIdpInitiated } from './portalAuthState';

describe('assertPortalAuthStateOrAllowIdpInitiated', () => {
  it('allows an IdP-initiated callback without state or a pending cookie', () => {
    expect(
      assertPortalAuthStateOrAllowIdpInitiated({
        ctx: { getCookie: () => undefined },
        surfaceId: 'surface_123'
      })
    ).toBe(false);
  });

  it('allows an IdP-initiated callback when a stale state cookie exists', () => {
    expect(
      assertPortalAuthStateOrAllowIdpInitiated({
        ctx: { getCookie: () => 'pending-state' },
        surfaceId: 'surface_123'
      })
    ).toBe(false);
  });

  it('continues to require an exact state match', () => {
    expect(() =>
      assertPortalAuthStateOrAllowIdpInitiated({
        ctx: { getCookie: () => 'pending-state' },
        surfaceId: 'surface_123',
        state: 'other-state'
      })
    ).toThrow();
  });
});
