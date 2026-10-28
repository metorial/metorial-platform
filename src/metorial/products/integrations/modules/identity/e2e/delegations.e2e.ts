import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import type { IdentityDelegation } from '@metorial-subspace/db';
import { Fabric } from '@metorial/fabric';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type CreateIdentityDelegationParams,
  identityActorService,
  identityDelegationConfigService,
  identityDelegationService,
  identityService
} from '../src';
import {
  createActor,
  createIdentity,
  findDelegatedIdentity,
  identityScope,
  inMinutes,
  pageAll,
  useRemoteProvider,
  waitForDelegatedIdentity
} from './_fixtures';

describe('module-identity delegations', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let provider = useRemoteProvider(org, server);

  let cleanups: (() => void)[] = [];

  afterEach(() => {
    for (let cleanup of cleanups.splice(0)) cleanup();
  });

  let setup = async () => {
    let owner = await createActor(org);
    let identity = await createIdentity(org, { actor: owner });
    let delegatee = await createActor(org);

    return { owner, identity, delegatee };
  };

  let delegate = async (input: CreateIdentityDelegationParams['input']) =>
    identityDelegationService.createIdentityDelegation({
      ...(await identityScope(org)),
      input
    });

  let refetch = async (delegation: IdentityDelegation) =>
    identityDelegationService.getIdentityDelegationById({
      ...(await identityScope(org)),
      identityDelegationId: delegation.id
    });

  let revoke = async (delegation: IdentityDelegation) =>
    identityDelegationService.revokeIdentityDelegation({
      ...(await identityScope(org)),
      delegation: await refetch(delegation)
    });

  let partyRoles = (delegation: Awaited<ReturnType<typeof delegate>>) =>
    Object.fromEntries(
      delegation.parties.map(party => [party.actor.id, [...party.roles].sort()])
    );

  it('creates an approved delegation with owner, delegator and delegatee parties', async () => {
    let scope = await identityScope(org);
    let { owner, identity, delegatee } = await setup();
    let defaultConfig = await identityDelegationConfigService.getIdentityDelegationConfigById({
      ...scope,
      identityDelegationConfigId: 'default'
    });
    let events: string[] = [];
    cleanups.push(
      Fabric.listen('identity.delegation.created:after', async event => {
        events.push(event.identityDelegation.id);
      })
    );

    let delegation = await delegate({
      identity,
      delegatee,
      permissions: ['provider_read'],
      note: 'Read access for e2e',
      metadata: { ticket: 'E2E-1' }
    });
    expect(delegation).toMatchObject({
      status: 'active',
      delegationLevel: 0,
      permissions: ['provider_read'],
      deniedReason: null,
      wasCoveredByPreviousDelegationAndAutoApproved: false,
      note: 'Read access for e2e',
      expiresAt: null,
      request: null
    });
    expect(delegation.identity.id).toBe(identity.id);
    expect(delegation.attestation?.type).toBe('api');
    expect(delegation.delegationConfig?.id).toBe(defaultConfig.id);
    expect(partyRoles(delegation)).toEqual({
      [owner.id]: ['delegator', 'owner'],
      [delegatee.id]: ['delegatee']
    });
    expect(events).toContain(delegation.id);

    let row = await subspaceDb.identityDelegation.findUniqueOrThrow({
      where: { id: delegation.id }
    });
    expect(row).toMatchObject({
      delegateeOid: delegatee.oid,
      subDelegatedFromOid: null,
      selectedDelegationConfigVersionOid: defaultConfig.currentVersionOid,
      metadata: { ticket: 'E2E-1' },
      tenantOid: identity.tenantOid,
      environmentOid: identity.environmentOid
    });

    let fetched = await refetch(delegation);
    expect(fetched.parties).toHaveLength(2);

    await waitForDelegatedIdentity(identity, delegatee, {
      isActive: true,
      permissions: ['provider_read']
    });
  });

  it('uses an explicitly selected delegation config', async () => {
    let scope = await identityScope(org);
    let { identity, delegatee } = await setup();
    let config = await identityDelegationConfigService.createIdentityDelegationConfig({
      ...scope,
      input: {
        name: uniqueId('config'),
        subDelegationBehavior: 'allow',
        subDelegationDepth: 2
      }
    });

    let delegation = await delegate({
      identity,
      delegatee,
      permissions: ['provider_call'],
      delegationConfigId: config.id
    });
    expect(delegation.delegationConfig?.id).toBe(config.id);
    expect(
      (await subspaceDb.identityDelegation.findUniqueOrThrow({ where: { id: delegation.id } }))
        .selectedDelegationConfigVersionOid
    ).toBe(config.currentVersionOid);
  });

  it('lists delegations by identity, party, permission and status', async () => {
    let scope = await identityScope(org);
    let { owner, identity, delegatee } = await setup();
    let secondDelegatee = await createActor(org);

    let reader = await delegate({ identity, delegatee, permissions: ['provider_read'] });
    let caller = await delegate({
      identity,
      delegatee: secondDelegatee,
      permissions: ['provider_call']
    });
    await revoke(caller);

    let list = async (
      filter: Omit<
        Parameters<typeof identityDelegationService.listIdentityDelegations>[0],
        'instance'
      >
    ) =>
      (
        await firstPage(
          await identityDelegationService.listIdentityDelegations({ ...scope, ...filter })
        )
      )
        .map(item => item.id)
        .sort();

    let both = [reader.id, caller.id].sort();
    expect(await list({ identityIds: [identity.id] })).toEqual(both);
    expect(await list({ ownerActorIds: [owner.id] })).toEqual(both);
    expect(await list({ delegatorActorIds: [owner.id] })).toEqual(both);
    expect(await list({ delegateeActorIds: [delegatee.id] })).toEqual([reader.id]);
    expect(await list({ delegatorActorIds: [delegatee.id] })).toEqual([]);
    expect(await list({ identityIds: [identity.id], permissions: ['provider_call'] })).toEqual(
      [caller.id]
    );
    expect(await list({ identityIds: [identity.id], status: ['revoked'] })).toEqual([
      caller.id
    ]);
    expect(await list({ identityIds: [identity.id], status: ['active'] })).toEqual([
      reader.id
    ]);

    let paged = await pageAll(
      await identityDelegationService.listIdentityDelegations({
        ...scope,
        identityIds: [identity.id]
      })
    );
    expect(paged.map(item => item.id).sort()).toEqual(both);
  });

  it('rejects delegations that are invalid or would grant nothing', async () => {
    let scope = await identityScope(org);
    let { owner, identity, delegatee } = await setup();
    let archivedActor = await identityActorService.archiveIdentityActor({
      ...scope,
      identityActor: await createActor(org)
    });
    let archivedIdentity = await identityService.archiveIdentity({
      ...scope,
      identity: await createIdentity(org, { actor: owner })
    });
    let archivedConfig = await identityDelegationConfigService.archiveIdentityDelegationConfig(
      {
        ...scope,
        identityDelegationConfig:
          await identityDelegationConfigService.createIdentityDelegationConfig({
            ...scope,
            input: { subDelegationBehavior: 'deny' }
          })
      }
    );
    let permissions = ['provider_read' as const];

    let attempts: [Partial<CreateIdentityDelegationParams['input']>, string][] = [
      [{ delegatee: owner }, 'bad_request'],
      [{ delegator: delegatee }, 'bad_request'],
      [{ permissions: [] }, 'bad_request'],
      [
        {
          permissions: [],
          credentialOverrides: [{ credentialId: uniqueId('credential'), permissions: [] }]
        },
        'bad_request'
      ],
      [{ expiresAt: new Date(Date.now() - 60_000) }, 'bad_request'],
      [
        {
          credentialOverrides: [
            {
              credentialId: uniqueId('credential'),
              permissions,
              expiresAt: new Date(Date.now() - 60_000)
            }
          ]
        },
        'bad_request'
      ],
      [{ credentialOverrides: [{ credentialId: uniqueId('credential') }] }, 'not_found'],
      [{ delegationConfigId: uniqueId('config') }, 'not_found'],
      [{ delegationConfigId: archivedConfig.id }, 'use_after_delete'],
      [{ delegatee: archivedActor }, 'use_after_delete'],
      [{ identity: archivedIdentity }, 'use_after_delete']
    ];

    for (let [input, code] of attempts) {
      await expectServiceError(delegate({ identity, delegatee, permissions, ...input }), code);
    }

    expect(
      await subspaceDb.identityDelegation.count({
        where: { identityOid: { in: [identity.oid, archivedIdentity.oid] } }
      })
    ).toBe(0);
  });

  it('revokes an active delegation exactly once', async () => {
    let { identity, delegatee } = await setup();
    let delegation = await delegate({ identity, delegatee, permissions: ['provider_read'] });
    let events: string[] = [];
    cleanups.push(
      Fabric.listen('identity.delegation.revoked:after', async event => {
        events.push(event.identityDelegation.id);
      })
    );

    let revoked = await revoke(delegation);
    expect(revoked.status).toBe('revoked');
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    expect(events).toEqual([delegation.id]);

    await expectServiceError(revoke(delegation), 'bad_request');
    expect((await refetch(delegation)).status).toBe('revoked');
  });

  it('scopes credential overrides to credentials of the delegated identity', async () => {
    let { owner, delegatee } = await setup();
    let identity = await createIdentity(org, {
      actor: owner,
      inputs: [{ deploymentId: provider.deploymentId }]
    });
    let otherIdentity = await createIdentity(org, {
      inputs: [{ deploymentId: provider.deploymentId }]
    });
    let credential = identity.credentials[0]!;
    let expiresAt = inMinutes(60);

    await expectServiceError(
      delegate({
        identity,
        delegatee,
        credentialOverrides: [
          { credentialId: otherIdentity.credentials[0]!.id, permissions: ['provider_call'] }
        ]
      }),
      'not_found'
    );

    let delegation = await delegate({
      identity,
      delegatee,
      credentialOverrides: [
        { credentialId: credential.id, permissions: ['provider_call'], expiresAt }
      ]
    });
    expect(delegation.permissions).toEqual([]);
    expect(delegation.credentials.map(item => item.credential.id)).toEqual([credential.id]);
    expect(delegation.credentials[0]).toMatchObject({
      status: 'active',
      permissions: ['provider_call'],
      expiresAt
    });
  });

  it('reconciles delegations into delegated identities and tracks their changes', async () => {
    let { owner, delegatee } = await setup();
    let identity = await createIdentity(org, {
      actor: owner,
      inputs: [{ deploymentId: provider.deploymentId }]
    });
    let credential = identity.credentials[0]!;
    let expiresAt = inMinutes(60);

    let delegation = await delegate({
      identity,
      delegatee,
      permissions: ['provider_read'],
      credentialOverrides: [
        { credentialId: credential.id, permissions: ['provider_call'], expiresAt }
      ]
    });

    let { delegated } = await waitForDelegatedIdentity(identity, delegatee, {
      isActive: true,
      permissions: ['provider_read'],
      delegationLevel: 0,
      atLeastHoldsUntil: null
    });
    expect(delegated.credentials).toHaveLength(1);
    expect(delegated.credentials[0]).toMatchObject({
      credentialOid: credential.oid,
      isActive: true,
      permissions: ['provider_call'],
      atLeastHoldsUntil: expiresAt
    });
    expect(delegated.delegatedIdentityUpdates.every(update => update.isActiveAfter)).toBe(
      true
    );
    expect(await findDelegatedIdentity(identity, owner)).toBeNull();

    await revoke(delegation);

    let { delegated: afterRevoke } = await waitForDelegatedIdentity(identity, delegatee, {
      isActive: false,
      permissions: []
    });
    expect(afterRevoke.credentials[0]).toMatchObject({ isActive: false, permissions: [] });
    expect(afterRevoke.delegatedIdentityUpdates).toContainEqual(
      expect.objectContaining({
        isActiveBefore: true,
        isActiveAfter: false,
        permissionsBefore: ['provider_read'],
        permissionsAfter: []
      })
    );
  });

  it('deactivates delegated identities when the identity is archived', async () => {
    let scope = await identityScope(org);
    let { identity, delegatee } = await setup();
    await delegate({ identity, delegatee, permissions: ['provider_read', 'provider_call'] });
    await waitForDelegatedIdentity(identity, delegatee, { isActive: true });

    await identityService.archiveIdentity({ ...scope, identity });

    await waitForDelegatedIdentity(identity, delegatee, {
      isActive: false,
      permissions: [],
      delegationLevel: 0
    });
  });

  it('sub-delegates with an increasing delegation level', async () => {
    let scope = await identityScope(org);
    let { owner, identity, delegatee } = await setup();
    let subDelegatee = await createActor(org);

    let first = await delegate({
      identity,
      delegatee,
      permissions: ['provider_read', 'provider_call']
    });
    let { identity: reconciled } = await waitForDelegatedIdentity(identity, delegatee, {
      isActive: true
    });

    let second = await delegate({
      identity: reconciled,
      delegator: delegatee,
      delegatee: subDelegatee,
      permissions: ['provider_read']
    });
    expect(second).toMatchObject({ status: 'active', delegationLevel: 1 });
    expect(partyRoles(second)).toEqual({
      [owner.id]: ['owner'],
      [delegatee.id]: ['delegator'],
      [subDelegatee.id]: ['delegatee']
    });
    expect(
      (await subspaceDb.identityDelegation.findUniqueOrThrow({ where: { id: second.id } }))
        .subDelegatedFromOid
    ).toBe(delegatee.oid);

    let byDelegator = await firstPage(
      await identityDelegationService.listIdentityDelegations({
        ...scope,
        delegatorActorIds: [delegatee.id]
      })
    );
    expect(byDelegator.map(item => item.id)).toEqual([second.id]);

    await waitForDelegatedIdentity(identity, subDelegatee, {
      isActive: true,
      delegationLevel: 1,
      permissions: ['provider_read']
    });
    expect(await findDelegatedIdentity(identity, delegatee)).toMatchObject({
      delegationLevel: first.delegationLevel
    });
  });

  it('expires delegations in the worker and reconciles the identity', async () => {
    let { identity, delegatee } = await setup();
    let delegation = await delegate({
      identity,
      delegatee,
      permissions: ['provider_read'],
      expiresAt: new Date(Date.now() + 5_000)
    });

    await eventually(
      async () => {
        let row = await subspaceDb.identityDelegation.findUniqueOrThrow({
          where: { id: delegation.id }
        });
        expect(row.status).toBe('expired');
      },
      { timeoutMs: 100_000, intervalMs: 1_000 }
    );

    await eventually(async () => {
      let row = await subspaceDb.identity.findUniqueOrThrow({ where: { id: identity.id } });
      expect(row.needsReconciliation).toBe(false);
      expect(await findDelegatedIdentity(identity, delegatee)).toMatchObject({
        isActive: false,
        permissions: []
      });
    });
  }, 150_000);

  it('does not resolve, list or modify delegations of another tenant', async () => {
    let { owner, identity, delegatee } = await setup();
    let delegation = await delegate({ identity, delegatee, permissions: ['provider_read'] });
    let otherScope = await identityScope(otherOrg);

    await expectServiceError(
      identityDelegationService.getIdentityDelegationById({
        ...otherScope,
        identityDelegationId: delegation.id
      }),
      'not_found'
    );
    for (let filter of [
      { ids: [delegation.id] },
      { identityIds: [identity.id] },
      { ownerActorIds: [owner.id] }
    ]) {
      expect(
        await firstPage(
          await identityDelegationService.listIdentityDelegations({ ...otherScope, ...filter })
        )
      ).toEqual([]);
    }

    await expect(
      identityDelegationService.createIdentityDelegation({
        ...otherScope,
        input: { identity, delegatee, permissions: ['provider_call'] }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      identityDelegationService.revokeIdentityDelegation({ ...otherScope, delegation })
    ).rejects.toThrow('Tenant mismatch');

    expect((await refetch(delegation)).status).toBe('active');
  });
});
