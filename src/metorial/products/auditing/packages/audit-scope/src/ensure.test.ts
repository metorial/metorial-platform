import { describe, expect, it } from 'vitest';
import {
  ensureInstanceActorAuditScope,
  ensureInstanceAuditScope,
  ensureOrganizationActorAuditScope,
  ensureOrganizationAuditScope,
  ensureOrganizationMemberAuditScope,
  ensureProjectActorAuditScope,
  ensureProjectAuditScope
} from './ensure';

let context = { ip: '127.0.0.1' };
let organization = { oid: 1n, id: 'org_1' };
let project = { oid: 21n, id: 'pro_1' };
let instance = { oid: 31n, id: 'ins_1' };
let organizationActor = { oid: 11n, id: 'oac_1' };

describe('ensure audit scopes', () => {
  it('builds an organization scope without an organization actor', async () => {
    await expect(
      ensureOrganizationAuditScope({
        organization,
        actor: { type: 'system', id: 'worker' },
        context
      })
    ).resolves.toEqual({
      organizationOid: 1n,
      projectOid: undefined,
      instanceOid: undefined,
      organizationActorOid: undefined,
      actor: { type: 'system', id: 'worker' },
      context
    });
  });

  it('builds an organization actor scope', async () => {
    await expect(
      ensureOrganizationActorAuditScope({
        organization,
        organizationActor,
        context
      })
    ).resolves.toEqual({
      organizationOid: 1n,
      projectOid: undefined,
      instanceOid: undefined,
      organizationActorOid: 11n,
      actor: { type: 'org_actor', id: 'oac_1' },
      context
    });
  });

  it('delegates organization member scopes to the member actor', async () => {
    await expect(
      ensureOrganizationMemberAuditScope({
        organization,
        member: {
          actor: organizationActor
        },
        context
      })
    ).resolves.toMatchObject({
      organizationActorOid: 11n,
      actor: { type: 'org_actor', id: 'oac_1' }
    });
  });

  it('builds a project scope', async () => {
    await expect(
      ensureProjectAuditScope({
        organization,
        project,
        actor: { type: 'system', id: 'worker' },
        context
      })
    ).resolves.toEqual({
      organizationOid: 1n,
      projectOid: 21n,
      instanceOid: undefined,
      organizationActorOid: undefined,
      actor: { type: 'system', id: 'worker' },
      context
    });
  });

  it('builds a project actor scope', async () => {
    await expect(
      ensureProjectActorAuditScope({
        organization,
        project,
        organizationActor,
        context
      })
    ).resolves.toEqual({
      organizationOid: 1n,
      projectOid: 21n,
      instanceOid: undefined,
      organizationActorOid: 11n,
      actor: { type: 'org_actor', id: 'oac_1' },
      context
    });
  });

  it('builds an instance scope', async () => {
    await expect(
      ensureInstanceAuditScope({
        organization,
        project,
        instance,
        actor: { type: 'fine_grained_token', id: 'fgk_1' },
        context
      })
    ).resolves.toEqual({
      organizationOid: 1n,
      projectOid: 21n,
      instanceOid: 31n,
      organizationActorOid: undefined,
      actor: { type: 'fine_grained_token', id: 'fgk_1' },
      context
    });
  });

  it('builds an instance actor scope', async () => {
    await expect(
      ensureInstanceActorAuditScope({
        organization,
        project,
        instance,
        organizationActor,
        context
      })
    ).resolves.toEqual({
      organizationOid: 1n,
      projectOid: 21n,
      instanceOid: 31n,
      organizationActorOid: 11n,
      actor: { type: 'org_actor', id: 'oac_1' },
      context
    });
  });
});
