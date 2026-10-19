import { describe, expect, it } from 'vitest';
import {
  assertNoneArePublicMcpOwned,
  assertNotPublicMcpOwned,
  assertNotPublicMcpOwnedOrNotFound,
  excludePublicMcpOwned,
  getPublicMcpAccess,
  hasPublicMcpAccessTo,
  runWithPublicMcpAccess
} from './index';

let owned = { ownerPublicMcpServerOid: 10n };
let unowned = { ownerPublicMcpServerOid: null };

describe('public MCP guard', () => {
  it('allows resources that no public MCP server owns', () => {
    expect(hasPublicMcpAccessTo(unowned)).toBe(true);
    expect(hasPublicMcpAccessTo({})).toBe(true);
    expect(hasPublicMcpAccessTo(null)).toBe(true);
    expect(() => assertNotPublicMcpOwned(unowned, 'provider_config')).not.toThrow();
  });

  it('rejects owned resources outside a capability scope', () => {
    expect(hasPublicMcpAccessTo(owned)).toBe(false);
    expect(() => assertNotPublicMcpOwned(owned, 'provider_auth_config')).toThrowError(
      /provider auth config belongs to a public MCP server/
    );
    expect(() => assertNotPublicMcpOwnedOrNotFound(owned, 'provider_config')).toThrow();
    expect(() => assertNoneArePublicMcpOwned([unowned, owned], 'session')).toThrow();
  });

  it('allows owned resources only inside the owning server scope', () => {
    runWithPublicMcpAccess({ publicMcpServerOid: 10n }, () => {
      expect(hasPublicMcpAccessTo(owned)).toBe(true);
      expect(() => assertNotPublicMcpOwned(owned, 'provider_config')).not.toThrow();
    });

    runWithPublicMcpAccess({ publicMcpServerOid: 11n }, () => {
      expect(hasPublicMcpAccessTo(owned)).toBe(false);
      expect(() => assertNotPublicMcpOwned(owned, 'provider_config')).toThrow();
    });
  });

  it('keeps the scope across async boundaries and drops it afterwards', async () => {
    await runWithPublicMcpAccess({ publicMcpServerOid: 10n }, async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      expect(getPublicMcpAccess()?.publicMcpServerOid).toBe(10n);
    });

    expect(getPublicMcpAccess()).toBeNull();
  });

  it('builds list filters that hide other owners', () => {
    expect(excludePublicMcpOwned()).toEqual({ ownerPublicMcpServerOid: null });

    runWithPublicMcpAccess({ publicMcpServerOid: 10n }, () => {
      expect(excludePublicMcpOwned()).toEqual({
        OR: [{ ownerPublicMcpServerOid: null }, { ownerPublicMcpServerOid: 10n }]
      });
    });
  });
});
