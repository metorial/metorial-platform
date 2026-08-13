import { describe, expect, it } from 'vitest';
import { createAuditScope } from './scope';

describe('createAuditScope', () => {
  it('creates an organization actor scope', () => {
    let context = { ip: '127.0.0.1' };

    expect(
      createAuditScope({
        organization: { oid: 1n },
        project: { oid: 2n },
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
      projectOid: 2n,
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
        project: { oid: 2n },
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
      projectOid: 2n,
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
