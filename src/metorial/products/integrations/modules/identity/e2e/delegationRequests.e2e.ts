import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  type CreateIdentityDelegationParams,
  type CreateIdentityDelegationRequestParams,
  identityDelegationConfigService,
  identityDelegationRequestService,
  identityDelegationService
} from '../src';
import {
  createActor,
  createIdentity,
  identityScope,
  inMinutes,
  waitForDelegatedIdentity,
  waitForReconciliation
} from './_fixtures';

describe('module-identity delegation requests', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let setup = async () => {
    let owner = await createActor(org);
    let identity = await createIdentity(org, { actor: owner });
    let reconciled = await waitForReconciliation(identity.id);
    let requester = await createActor(org);

    return { owner, identity: reconciled, requester };
  };

  let requestDelegation = async (input: CreateIdentityDelegationRequestParams['input']) =>
    identityDelegationRequestService.createIdentityDelegationRequest({
      ...(await identityScope(org)),
      input
    });

  let delegate = async (input: CreateIdentityDelegationParams['input']) =>
    identityDelegationService.createIdentityDelegation({
      ...(await identityScope(org)),
      input
    });

  let fetchRequest = async (request: { id: string }) =>
    identityDelegationRequestService.getIdentityDelegationRequestById({
      ...(await identityScope(org)),
      identityDelegationRequestId: request.id
    });

  let approve = async (request: { id: string }) =>
    identityDelegationRequestService.approveIdentityDelegationRequest({
      ...(await identityScope(org)),
      delegationRequest: await fetchRequest(request)
    });

  let deny = async (request: { id: string }) =>
    identityDelegationRequestService.denyIdentityDelegationRequest({
      ...(await identityScope(org)),
      delegationRequest: await fetchRequest(request)
    });

  it('creates a pending request that is approved exactly once', async () => {
    let scope = await identityScope(org);
    let { owner, identity, requester } = await setup();
    let expiresAt = inMinutes(60);

    let request = await requestDelegation({
      identity,
      requester,
      permissions: ['provider_call'],
      expiresAt,
      note: 'Needs to call tools'
    });
    expect(request).toMatchObject({ status: 'pending', expiresAt });
    expect(request.requester.id).toBe(requester.id);
    expect(request.identity.id).toBe(identity.id);
    expect(request.delegation).toMatchObject({
      status: 'waiting_for_consent',
      delegationLevel: 0,
      permissions: ['provider_call'],
      expiresAt,
      note: 'Needs to call tools',
      attestation: null
    });
    expect(
      Object.fromEntries(
        request.delegation.parties.map(party => [party.actor.id, [...party.roles].sort()])
      )
    ).toEqual({ [owner.id]: ['delegator', 'owner'], [requester.id]: ['delegatee'] });

    let row = await subspaceDb.identityDelegationRequest.findUniqueOrThrow({
      where: { id: request.id }
    });
    expect(row).toMatchObject({
      requesterOid: requester.oid,
      identityOid: identity.oid,
      delegationOid: request.delegation.oid,
      attestationOid: null
    });

    for (let filter of [
      { actorIds: [requester.id] },
      { identityIds: [identity.id] },
      { identityIds: [identity.id], status: ['pending' as const] }
    ]) {
      let listed = await firstPage(
        await identityDelegationRequestService.listIdentityDelegationRequests({
          ...scope,
          ...filter
        })
      );
      expect(listed.map(item => item.id)).toEqual([request.id]);
    }

    let approved = await approve(request);
    expect(approved.status).toBe('approved');
    expect(approved.delegation).toMatchObject({ status: 'active', deniedReason: null });
    expect(approved.delegation.attestation?.type).toBe('request_approval');
    expect(
      (
        await subspaceDb.identityDelegationRequest.findUniqueOrThrow({
          where: { id: request.id }
        })
      ).attestationOid
    ).toBe(approved.delegation.attestationOid);

    await expectServiceError(approve(request), 'bad_request');
    await expectServiceError(deny(request), 'bad_request');

    await waitForDelegatedIdentity(identity, requester, {
      isActive: true,
      permissions: ['provider_call'],
      atLeastHoldsUntil: expiresAt
    });
  });

  it('denies a pending request', async () => {
    let { identity, requester } = await setup();
    let request = await requestDelegation({
      identity,
      requester,
      permissions: ['provider_read'],
      expiresAt: inMinutes(30)
    });

    let denied = await deny(request);
    expect(denied.status).toBe('denied');
    expect(denied.delegation).toMatchObject({
      status: 'denied',
      deniedReason: 'request_denied',
      attestation: null
    });

    await expectServiceError(approve(request), 'bad_request');
  });

  it('cancels a pending request when its delegation is revoked', async () => {
    let scope = await identityScope(org);
    let { identity, requester } = await setup();
    let request = await requestDelegation({
      identity,
      requester,
      permissions: ['provider_read'],
      expiresAt: inMinutes(30)
    });

    let revoked = await identityDelegationService.revokeIdentityDelegation({
      ...scope,
      delegation: request.delegation
    });
    expect(revoked.status).toBe('revoked');
    expect(await fetchRequest(request)).toMatchObject({ status: 'canceled' });

    await expectServiceError(approve(request), 'bad_request');
  });

  it('rejects requests that expire in the past, grant nothing or come from the owner', async () => {
    let { owner, identity, requester } = await setup();
    let expiresAt = inMinutes(30);
    let permissions = ['provider_read' as const];

    await expectServiceError(
      requestDelegation({
        identity,
        requester,
        permissions,
        expiresAt: new Date(Date.now() - 60_000)
      }),
      'bad_request'
    );
    await expectServiceError(
      requestDelegation({ identity, requester, permissions: [], expiresAt }),
      'bad_request'
    );
    await expectServiceError(
      requestDelegation({ identity, requester: owner, permissions, expiresAt }),
      'bad_request'
    );

    expect(
      await subspaceDb.identityDelegationRequest.count({
        where: { identityOid: identity.oid }
      })
    ).toBe(0);
  });

  it('auto-approves requests covered by an existing delegation', async () => {
    let { identity: created, requester } = await setup();
    await delegate({
      identity: created,
      delegatee: requester,
      permissions: ['provider_read']
    });
    let { identity } = await waitForDelegatedIdentity(created, requester, {
      isActive: true,
      permissions: ['provider_read']
    });

    let covered = await requestDelegation({
      identity,
      requester,
      permissions: ['provider_read'],
      expiresAt: inMinutes(30)
    });
    expect(covered.status).toBe('approved');
    expect(covered.delegation).toMatchObject({
      status: 'active',
      wasCoveredByPreviousDelegationAndAutoApproved: true
    });
    expect(covered.delegation.attestation?.type).toBe(
      'covered_by_previously_approved_delegation'
    );
    expect(
      (
        await subspaceDb.identityDelegationRequest.findUniqueOrThrow({
          where: { id: covered.id }
        })
      ).attestationOid
    ).toBe(covered.delegation.attestationOid);

    let uncovered = await requestDelegation({
      identity,
      requester,
      permissions: ['provider_call'],
      expiresAt: inMinutes(30)
    });
    expect(uncovered.status).toBe('pending');
    expect(uncovered.delegation.status).toBe('waiting_for_consent');

    await waitForReconciliation(identity.id);
    await waitForDelegatedIdentity(identity, requester, {
      isActive: true,
      permissions: ['provider_read']
    });
  });

  it('denies sub-delegation requests under the default config', async () => {
    let { identity: created, requester: delegator } = await setup();
    let subRequester = await createActor(org);
    await delegate({
      identity: created,
      delegatee: delegator,
      permissions: ['provider_read']
    });
    let { identity } = await waitForDelegatedIdentity(created, delegator, { isActive: true });

    let request = await requestDelegation({
      identity,
      delegator,
      requester: subRequester,
      permissions: ['provider_read'],
      expiresAt: inMinutes(30)
    });
    expect(request.status).toBe('denied');
    expect(request.delegation).toMatchObject({
      status: 'denied',
      deniedReason: 'sub_delegation_denied',
      delegationLevel: 1
    });
  });

  it('allows sub-delegation requests up to the configured depth', async () => {
    let scope = await identityScope(org);
    let { identity: created, requester: firstDelegatee } = await setup();
    let secondDelegatee = await createActor(org);
    let config = await identityDelegationConfigService.createIdentityDelegationConfig({
      ...scope,
      input: {
        name: uniqueId('config'),
        subDelegationBehavior: 'allow',
        subDelegationDepth: 1
      }
    });
    let permissions = ['provider_read' as const];

    await delegate({ identity: created, delegatee: firstDelegatee, permissions });
    let { identity } = await waitForDelegatedIdentity(created, firstDelegatee, {
      isActive: true
    });
    await delegate({
      identity,
      delegator: firstDelegatee,
      delegatee: secondDelegatee,
      permissions
    });
    ({ identity } = await waitForDelegatedIdentity(created, secondDelegatee, {
      isActive: true,
      delegationLevel: 1
    }));

    let tooDeep = await requestDelegation({
      identity,
      delegator: secondDelegatee,
      requester: await createActor(org),
      permissions,
      expiresAt: inMinutes(30),
      delegationConfigId: config.id
    });
    expect(tooDeep.status).toBe('denied');
    expect(tooDeep.delegation).toMatchObject({
      deniedReason: 'sub_delegation_depth_exceeded',
      delegationLevel: 2
    });

    let withinDepth = await requestDelegation({
      identity,
      delegator: firstDelegatee,
      requester: await createActor(org),
      permissions,
      expiresAt: inMinutes(30),
      delegationConfigId: config.id
    });
    expect(withinDepth.status).toBe('pending');
    expect(withinDepth.delegation).toMatchObject({
      status: 'waiting_for_consent',
      delegationLevel: 1
    });
    expect(withinDepth.delegation.delegationConfig?.id).toBe(config.id);
  });

  it('does not resolve, list or approve requests of another tenant', async () => {
    let { identity, requester } = await setup();
    let request = await requestDelegation({
      identity,
      requester,
      permissions: ['provider_read'],
      expiresAt: inMinutes(30)
    });
    let otherScope = await identityScope(otherOrg);

    await expectServiceError(
      identityDelegationRequestService.getIdentityDelegationRequestById({
        ...otherScope,
        identityDelegationRequestId: request.id
      }),
      'not_found'
    );
    for (let filter of [{ ids: [request.id] }, { identityIds: [identity.id] }]) {
      expect(
        await firstPage(
          await identityDelegationRequestService.listIdentityDelegationRequests({
            ...otherScope,
            ...filter
          })
        )
      ).toEqual([]);
    }

    await expect(
      identityDelegationRequestService.approveIdentityDelegationRequest({
        ...otherScope,
        delegationRequest: await fetchRequest(request)
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      identityDelegationRequestService.createIdentityDelegationRequest({
        ...otherScope,
        input: {
          identity,
          requester: await createActor(otherOrg),
          permissions: ['provider_read'],
          expiresAt: inMinutes(30)
        }
      })
    ).rejects.toThrow('Tenant mismatch');

    expect(await fetchRequest(request)).toMatchObject({ status: 'pending' });
  });
});
