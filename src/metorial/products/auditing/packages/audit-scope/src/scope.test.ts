import { describe, expect, it } from 'vitest';
import {
  bindAuditScope,
  createAuditScope,
  createOrganizationActorAuditActor,
  createOrganizationActorAuditScope,
  isOrganizationActorAuditActor,
  isOrganizationActorAuditScope
} from './scope';

describe('createAuditScope', () => {
  it('creates an organization actor scope', () => {
    let context = { ip: '127.0.0.1' };

    expect(
      createAuditScope({
        organization: { oid: 1n },
        instance: { oid: 3n },
        organizationActor: { oid: 4n },
        actor: {
          type: 'org_actor',
          id: 'oac_1'
        },
        context
      })
    ).toEqual({
      organizationOid: 1n,
      instanceOid: 3n,
      organizationActorOid: 4n,
      actor: {
        type: 'org_actor',
        id: 'oac_1'
      },
      context
    });
  });

  it('creates a fine-grained scope without an organization actor', () => {
    let context = { ip: '127.0.0.1' };

    expect(
      createAuditScope({
        organization: { oid: 1n },
        instance: { oid: 3n },
        actor: {
          type: 'fine_grained_token',
          id: 'fgk_1',
          metadata: {
            sessionIds: ['ses_1', 'ses_2']
          }
        },
        context
      })
    ).toEqual({
      organizationOid: 1n,
      instanceOid: 3n,
      organizationActorOid: undefined,
      actor: {
        type: 'fine_grained_token',
        id: 'fgk_1',
        metadata: {
          sessionIds: ['ses_1', 'ses_2']
        }
      },
      context
    });
  });

  it('accepts consumer-profile and system actors', () => {
    let base = {
      organization: { oid: 1n },
      context: { ip: '127.0.0.1' }
    };

    expect(
      createAuditScope({
        ...base,
        actor: { type: 'consumer_profile', id: 'cop_1' }
      }).actor
    ).toEqual({ type: 'consumer_profile', id: 'cop_1' });
    expect(
      createAuditScope({
        ...base,
        actor: { type: 'system', id: 'worker' }
      }).actor
    ).toEqual({ type: 'system', id: 'worker' });
  });
});

describe('organization actor audit scope primitives', () => {
  it('builds typed organization actors and scopes with metadata', () => {
    let metadata = {
      source: 'dashboard',
      sessionIds: ['ses_1', 'ses_2']
    };
    let actor = createOrganizationActorAuditActor({
      organizationActor: { id: 'oac_1' },
      metadata
    });
    let scope = createOrganizationActorAuditScope({
      organization: { oid: 1n },
      instance: { oid: 3n },
      organizationActor: { oid: 4n, id: 'oac_1' },
      metadata,
      context: { ip: '127.0.0.1' }
    });

    expect(actor).toEqual({
      type: 'org_actor',
      id: 'oac_1',
      metadata
    });
    expect(scope).toMatchObject({
      organizationOid: 1n,
      instanceOid: 3n,
      organizationActorOid: 4n,
      actor: {
        type: 'org_actor',
        id: 'oac_1',
        metadata
      }
    });
    expect(isOrganizationActorAuditActor(actor)).toBe(true);
    expect(isOrganizationActorAuditScope(scope)).toBe(true);
  });

  it('rejects scopes without a complete organization actor binding', () => {
    let context = { ip: '127.0.0.1' };

    expect(
      isOrganizationActorAuditScope(
        createAuditScope({
          organization: { oid: 1n },
          actor: { type: 'system', id: 'worker' },
          context
        })
      )
    ).toBe(false);
    expect(
      isOrganizationActorAuditScope(
        createAuditScope({
          organization: { oid: 1n },
          actor: { type: 'org_actor', id: 'oac_1' },
          context
        })
      )
    ).toBe(false);
  });
});

describe('bindAuditScope', () => {
  it('promotes a scope while preserving its identity and request data', () => {
    let actor = {
      type: 'org_actor' as const,
      id: 'oac_1',
      metadata: {
        source: 'dashboard',
        sessionIds: ['ses_1']
      }
    };
    let context = { ip: '127.0.0.1', userAgent: 'vitest' };
    let scope = createAuditScope({
      organization: { oid: 1n },
      organizationActor: { oid: 4n },
      actor,
      context
    });

    let promoted = bindAuditScope({
      scope,
      organization: { oid: 2n },
      instance: { oid: 3n }
    });

    expect(promoted).toEqual({
      organizationOid: 2n,
      instanceOid: 3n,
      organizationActorOid: 4n,
      actor,
      context
    });
    expect(promoted.actor).toBe(actor);
    expect(promoted.context).toBe(context);
    expect(scope).toMatchObject({
      organizationOid: 1n,
      instanceOid: undefined
    });
  });

  it('binds to an organization without an instance', () => {
    let scope = createAuditScope({
      organization: { oid: 1n },
      instance: { oid: 3n },
      actor: { type: 'system', id: 'worker' },
      context: { ip: '127.0.0.1' }
    });

    expect(
      bindAuditScope({
        scope,
        organization: { oid: 2n }
      })
    ).toEqual({
      ...scope,
      organizationOid: 2n,
      instanceOid: undefined
    });
  });
});
