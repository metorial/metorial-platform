import { describe, expect, it } from 'vitest';
import {
  assertNoneArePublicMcpOwned,
  assertNotPublicMcpOwned,
  assertNotPublicMcpOwnedOrNotFound,
  assertPublicMcpScopeUsesOwned,
  getPublicMcpAccess,
  hasPublicMcpAccessTo,
  runWithPublicMcpAccess
} from './index';

let owned = { oid: 1n, ownerPublicMcpServerOid: 10n };
let unowned = { oid: 2n, ownerPublicMcpServerOid: null };

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
});

describe('public MCP grant scope', () => {
  let access = {
    publicMcpServerOid: 10n,
    grantOid: 100n,
    grantResources: { session: 1n, provider_config: 2n, provider_auth_config: 3n }
  };

  let ownedBy = (oid: bigint, extra: Record<string, unknown> = {}) => ({
    oid,
    ownerPublicMcpServerOid: 10n,
    ...extra
  });

  it('allows only the resources of the grant', () => {
    runWithPublicMcpAccess(access, () => {
      expect(hasPublicMcpAccessTo(ownedBy(1n), 'session')).toBe(true);
      expect(hasPublicMcpAccessTo(ownedBy(2n), 'provider_config')).toBe(true);
      expect(hasPublicMcpAccessTo(ownedBy(3n), 'provider_auth_config')).toBe(true);
      expect(hasPublicMcpAccessTo(ownedBy(7n, { sessionOid: 1n }), 'session_provider')).toBe(
        true
      );
    });
  });

  it("rejects another end user's resources on the same server", () => {
    runWithPublicMcpAccess(access, () => {
      expect(hasPublicMcpAccessTo(ownedBy(8n), 'session')).toBe(false);
      expect(hasPublicMcpAccessTo(ownedBy(8n), 'provider_config')).toBe(false);
      expect(hasPublicMcpAccessTo(ownedBy(8n), 'provider_auth_config')).toBe(false);
      expect(hasPublicMcpAccessTo(ownedBy(7n, { sessionOid: 9n }), 'session_provider')).toBe(
        false
      );
      expect(() => assertNotPublicMcpOwned(ownedBy(8n), 'session')).toThrow();
    });
  });

  it('does not match a resource of another type that shares an oid', () => {
    runWithPublicMcpAccess(access, () => {
      expect(hasPublicMcpAccessTo(ownedBy(1n), 'provider_config')).toBe(false);
      expect(hasPublicMcpAccessTo(ownedBy(2n), 'session')).toBe(false);
    });
  });

  it('rejects owned resources of entities the grant has no entry for', () => {
    runWithPublicMcpAccess(access, () => {
      expect(hasPublicMcpAccessTo(ownedBy(1n), 'provider_setup_session' as any)).toBe(false);
      expect(hasPublicMcpAccessTo(ownedBy(1n))).toBe(false);
    });

    runWithPublicMcpAccess(
      { ...access, grantResources: { provider_config: 2n, session: null } },
      () => {
        expect(hasPublicMcpAccessTo(ownedBy(1n), 'session')).toBe(false);
      }
    );
  });

  it('rejects resources owned by another server', () => {
    runWithPublicMcpAccess(access, () => {
      expect(hasPublicMcpAccessTo({ oid: 1n, ownerPublicMcpServerOid: 11n }, 'session')).toBe(
        false
      );
    });
  });
});

describe('assertPublicMcpScopeUsesOwned', () => {
  it('does nothing outside a public MCP scope', () => {
    expect(() => assertPublicMcpScopeUsesOwned(unowned, 'provider_auth_config')).not.toThrow();
  });

  it("rejects the organization's own resources inside a scope", () => {
    runWithPublicMcpAccess({ publicMcpServerOid: 10n }, () => {
      expect(() =>
        assertPublicMcpScopeUsesOwned(unowned, 'provider_auth_config')
      ).toThrowError(/can only use provider auth configs that belong to it/);
    });
  });

  it('accepts owned and missing resources inside a scope', () => {
    runWithPublicMcpAccess({ publicMcpServerOid: 10n }, () => {
      expect(() => assertPublicMcpScopeUsesOwned(owned, 'provider_auth_config')).not.toThrow();
      expect(() => assertPublicMcpScopeUsesOwned(null, 'provider_auth_config')).not.toThrow();
    });
  });
});
