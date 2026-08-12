import { describe, expect, it } from 'vitest';
import { createAuditScope } from './scope';

describe('createAuditScope', () => {
  it('creates an organization actor scope with a resource actor', () => {
    let context = { ip: '127.0.0.1' };

    expect(
      createAuditScope({
        resourceTenant: { oid: 1n },
        resourceGroup: { oid: 2n },
        resourceActor: { oid: 3n },
        actor: {
          type: 'org_actor',
          id: 'oac_1'
        },
        context
      })
    ).toEqual({
      resourceTenantOid: 1n,
      resourceGroupOid: 2n,
      resourceActorOid: 3n,
      actor: {
        type: 'org_actor',
        id: 'oac_1'
      },
      context
    });
  });

  it('creates a fine-grained scope without a resource actor', () => {
    let context = { ip: '127.0.0.1' };

    expect(
      createAuditScope({
        resourceTenant: { oid: 1n },
        resourceGroup: { oid: 2n },
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
      resourceTenantOid: 1n,
      resourceGroupOid: 2n,
      resourceActorOid: undefined,
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
      resourceTenant: { oid: 1n },
      resourceGroup: { oid: 2n },
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
