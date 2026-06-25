import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Identity,
  type IdentityActor,
  type IdentityDelegation,
  type IdentityDelegationConfigVersion,
  IdentityDelegationDeniedReason,
  IdentityDelegationPartyRole,
  IdentityDelegationPermissions,
  type IdentityDelegationRequest,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { checkDeletedRelation } from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { DelegationChecker } from '../lib/delegationChecker';
import { FoldedMap } from '../lib/foldedMap';
import { isInPastOptional } from '../lib/isInPast';
import {
  identityDelegationCreatedQueue,
  identityDelegationUpdatedQueue
} from '../queues/lifecycle/delegation';
import { delegationInclude } from './identityDelegation';
import { identityDelegationConfigService } from './identityDelegationConfig';

export interface CreateDelegationInput {
  identity: Identity;
  delegator?: IdentityActor;
  delegatee: IdentityActor;

  permissions?: IdentityDelegationPermissions[];
  expiresAt?: Date;

  delegationConfigId?: string;

  credentialOverrides?: {
    credentialId: string;
    permissions?: IdentityDelegationPermissions[];
    expiresAt?: Date;
  }[];

  note?: string;
  metadata?: Record<string, any>;
}

class identityDelegationInternalServiceImpl {
  async createDelegation(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    _internal:
      | { type: 'create_and_approve' }
      | { type: 'request'; requester: IdentityActor; expiresAt: Date };

    input: CreateDelegationInput;
  }) {
    checkTenant(d, d.input.identity);
    checkTenant(d, d.input.delegator);
    checkTenant(d, d.input.delegatee);

    checkDeletedRelation(d.input.identity);
    checkDeletedRelation(d.input.delegator);
    checkDeletedRelation(d.input.delegatee);

    if (d.input.delegatee.oid === d.input.delegator?.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Delegatee cannot be the same as delegator'
        })
      );
    }

    if (d.input.identity.actorOid === d.input.delegatee.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Delegatee cannot be the same as the owner identity'
        })
      );
    }

    // Make sure there are no delegations that don't do anything
    // (i.e. no permissions, no credential overrides with permissions)
    if (!d.input.permissions?.length) {
      let hasNestedPermissions = d.input.credentialOverrides?.some(o => o.permissions?.length);
      if (!hasNestedPermissions) {
        throw new ServiceError(
          badRequestError({
            message: 'At least one of delegation or credential permissions must be specified'
          })
        );
      }
    }

    if (isInPastOptional(d.input.expiresAt)) {
      throw new ServiceError(
        badRequestError({ message: 'Expiration date cannot be in the past' })
      );
    }
    for (let override of d.input.credentialOverrides ?? []) {
      if (isInPastOptional(override.expiresAt)) {
        throw new ServiceError(
          badRequestError({
            message: 'Credential override expiration date cannot be in the past'
          })
        );
      }
    }

    if (d._internal.type === 'request') {
      if (isInPastOptional(d._internal.expiresAt)) {
        throw new ServiceError(
          badRequestError({
            message: 'Request expiration date cannot be in the past'
          })
        );
      }

      if (
        d._internal.expiresAt &&
        d.input.expiresAt &&
        d._internal.expiresAt.getTime() !== d.input.expiresAt.getTime()
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'Request expiration date must be the same as delegation expiration date'
          })
        );
      }

      d.input.expiresAt = d._internal.expiresAt;
    }

    let credentialMap = await this.resolveCredentials({
      ...d,
      identity: d.input.identity,
      credentialIds: d.input.credentialOverrides?.map(o => o.credentialId) || []
    });

    let subDelegator =
      !d.input.delegator || d.input.delegator.oid === d.input.identity.actorOid
        ? undefined
        : d.input.delegator;
    let actualDelegationConfig = await this.resolveActualDelegationConfig({
      ...d,
      identity: d.input.identity,
      delegationConfigId: d.input.delegationConfigId
    });
    let delegationLevel = await this.resolveDelegationLevel({
      ...d,
      identity: d.input.identity,
      subDelegator
    });
    let autoDeniedReason =
      d._internal.type === 'request'
        ? this.getSubDelegationDeniedReason({
            delegationLevel,
            configVersion: actualDelegationConfig.currentVersion
          })
        : null;

    let parties = await this.computeParties(d.input);

    return await withTransaction(async db => {
      let delegation = await db.identityDelegation.create({
        data: {
          ...getId('identityDelegation'),
          status:
            d._internal.type == 'request'
              ? autoDeniedReason
                ? 'denied'
                : 'waiting_for_consent'
              : 'active',
          delegationLevel,
          wasCoveredByPreviousDelegationAndAutoApproved: false,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,

          permissions: d.input.permissions,
          deniedReason: autoDeniedReason,
          expiresAt: d.input.expiresAt,

          note: d.input.note,

          identityOid: d.input.identity.oid,
          delegateeOid: d.input.delegatee.oid,
          subDelegatedFromOid: subDelegator?.oid,

          selectedDelegationConfigVersionOid: actualDelegationConfig.currentVersionOid!,
          delegationConfigOid: actualDelegationConfig.oid
        }
      });

      await db.identityDelegationParty.createMany({
        data: parties.map(p => ({
          ...getId('identityDelegationParty'),
          delegationOid: delegation.oid,
          actorOid: p.actorOid,
          roles: p.roles
        }))
      });

      await db.identityDelegationCredentialOverride.createMany({
        data:
          d.input.credentialOverrides?.map(o => ({
            ...getId('identityDelegationCredentialOverride'),
            status: 'active',
            delegationOid: delegation.oid,
            credentialOid: credentialMap.get(o.credentialId)!.oid,
            permissions: o.permissions,
            expiresAt: o.expiresAt
          })) || []
      });

      // Check if we can auto-approve this request based on an existing
      // delegation that has the same or a superset of permissions and credential overrides
      if (delegation.status === 'waiting_for_consent') {
        let checker = await DelegationChecker.create({
          ...d,
          identity: d.input.identity,
          actor: d.input.delegatee
        });

        let alreadyAllowed = await checker.checkMany({
          identityRequirements: {
            expiresAt: d.input.expiresAt ?? null,
            permissions: d.input.permissions ?? []
          },
          credentials:
            d.input.credentialOverrides?.map(o => ({
              credential: credentialMap.get(o.credentialId)!,
              requirements: {
                expiresAt: o.expiresAt ?? null,
                permissions: o.permissions ?? []
              }
            })) ?? []
        });

        if (alreadyAllowed) {
          let attestation = await db.identityDelegationAttestation.create({
            data: {
              ...getId('identityDelegationAttestation'),
              type: 'covered_by_previously_approved_delegation'
            }
          });

          delegation = await db.identityDelegation.update({
            where: { oid: delegation.oid },
            data: {
              status: 'active',
              deniedReason: null,
              attestationOid: attestation.oid,
              wasCoveredByPreviousDelegationAndAutoApproved: true
            }
          });
        }
      }

      if (d._internal.type == 'request') {
        await db.identityDelegationRequest.createMany({
          data: {
            ...getId('identityDelegationRequest'),

            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,

            delegationOid: delegation.oid,
            requesterOid: d._internal.requester.oid,
            attestationOid: delegation.attestationOid,
            identityOid: d.input.identity.oid,

            expiresAt: d._internal.expiresAt,
            status:
              delegation.status === 'active'
                ? 'approved'
                : delegation.status === 'denied'
                  ? 'denied'
                  : 'pending'
          }
        });
      } else {
        let attestation = await db.identityDelegationAttestation.create({
          data: {
            ...getId('identityDelegationAttestation'),
            type: 'api'
          }
        });

        delegation = await db.identityDelegation.update({
          where: { oid: delegation.oid },
          data: { attestationOid: attestation.oid }
        });
      }

      await db.identity.updateMany({
        where: { oid: d.input.identity.oid },
        data: { needsReconciliation: true }
      });

      await addAfterTransactionHook(() =>
        identityDelegationCreatedQueue.add({ identityDelegationId: delegation.id })
      );

      return await db.identityDelegation.findUniqueOrThrow({
        where: { oid: delegation.oid },
        include: delegationInclude
      });
    });
  }

  async revokeIdentityDelegation(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegation: IdentityDelegation;
  }) {
    checkTenant(d, d.delegation);

    if (d.delegation.status !== 'active' && d.delegation.status !== 'waiting_for_consent') {
      throw new ServiceError(
        badRequestError({
          message: 'Only active or pending delegations can be revoked'
        })
      );
    }

    return await withTransaction(async db => {
      let delegation = await db.identityDelegation.update({
        where: { oid: d.delegation.oid },
        data: {
          status: 'revoked',
          revokedAt: new Date()
        },
        include: { request: true }
      });

      if (delegation.request?.status == 'pending') {
        await db.identityDelegationRequest.updateMany({
          where: { oid: delegation.request.oid },
          data: { status: 'canceled' }
        });
      }

      await db.identity.updateMany({
        where: { oid: delegation.identityOid },
        data: { needsReconciliation: true }
      });

      await addAfterTransactionHook(() =>
        identityDelegationUpdatedQueue.add({ identityDelegationId: delegation.id })
      );

      return await db.identityDelegation.findUniqueOrThrow({
        where: { oid: delegation.oid },
        include: delegationInclude
      });
    });
  }

  async alterIdentityDelegationRequest(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegationRequest: IdentityDelegationRequest & { delegation: IdentityDelegation };
    desiredStatus: 'approved' | 'denied';
  }) {
    checkTenant(d, d.delegationRequest);

    if (d.delegationRequest.status !== 'pending') {
      throw new ServiceError(
        badRequestError({
          message: 'Only pending delegation requests can be approved'
        })
      );
    }

    if (d.delegationRequest.delegation.status !== 'waiting_for_consent') {
      throw new ServiceError(
        badRequestError({
          message: 'Associated delegation is not in a state that can be modified'
        })
      );
    }

    return await withTransaction(async db => {
      let attestation =
        d.desiredStatus === 'approved'
          ? await db.identityDelegationAttestation.create({
              data: {
                ...getId('identityDelegationAttestation'),
                type: 'request_approval'
              }
            })
          : null;

      await db.identityDelegation.updateMany({
        where: { oid: d.delegationRequest.delegationOid },
        data: {
          attestationOid: attestation?.oid,
          status: d.desiredStatus === 'approved' ? 'active' : 'denied',
          deniedReason: d.desiredStatus === 'approved' ? null : 'request_denied'
        }
      });

      await db.identityDelegationRequest.updateMany({
        where: { oid: d.delegationRequest.oid },
        data: { status: d.desiredStatus, attestationOid: attestation?.oid }
      });

      await db.identity.updateMany({
        where: { oid: d.delegationRequest.identityOid },
        data: { needsReconciliation: true }
      });

      await addAfterTransactionHook(() =>
        identityDelegationUpdatedQueue.add({
          identityDelegationId: d.delegationRequest.delegation.id
        })
      );

      return await db.identityDelegation.findUniqueOrThrow({
        where: { oid: d.delegationRequest.delegationOid },
        include: delegationInclude
      });
    });
  }

  private async computeParties(d: {
    identity: Identity;
    delegator?: IdentityActor;
    delegatee: IdentityActor;
  }) {
    let ownerOid = d.identity.actorOid;
    let delegatorOid = d.delegator?.oid ?? ownerOid;
    let delegateeOid = d.delegatee.oid;

    let partiesMap = new FoldedMap<bigint, IdentityDelegationPartyRole>();
    partiesMap.put(ownerOid, 'owner');
    partiesMap.put(delegatorOid, 'delegator');
    partiesMap.put(delegateeOid, 'delegatee');

    return partiesMap.map((actorOid, roles) => ({ actorOid, roles }));
  }

  private async resolveActualDelegationConfig(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identity: Identity & { delegationConfigOid?: bigint | null };
    delegationConfigId?: string;
  }) {
    if (d.delegationConfigId) {
      let overriddenDelegationConfig = await db.identityDelegationConfig.findFirst({
        where: {
          id: d.delegationConfigId,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        include: { currentVersion: true }
      });

      if (!overriddenDelegationConfig) {
        throw new ServiceError(
          notFoundError('identity.delegation_config', d.delegationConfigId)
        );
      }

      checkTenant(d, overriddenDelegationConfig);
      checkDeletedRelation(overriddenDelegationConfig);

      return overriddenDelegationConfig;
    }

    if (d.identity.delegationConfigOid) {
      let identityDelegationConfig = await db.identityDelegationConfig.findUnique({
        where: { oid: d.identity.delegationConfigOid },
        include: { currentVersion: true }
      });

      if (identityDelegationConfig) {
        checkTenant(d, identityDelegationConfig);
        checkDeletedRelation(identityDelegationConfig);

        return identityDelegationConfig;
      }
    }

    return await identityDelegationConfigService.ensureDefaultIdentityDelegationConfig(d);
  }

  private async resolveDelegationLevel(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identity: Identity;
    subDelegator?: IdentityActor;
  }) {
    if (!d.subDelegator) return 0;

    let checker = await DelegationChecker.create({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      identity: d.identity,
      actor: d.subDelegator
    });

    return checker.delegationLevel + 1;
  }

  private getSubDelegationDeniedReason(d: {
    delegationLevel: number;
    configVersion: IdentityDelegationConfigVersion | null;
  }) {
    let configVersion = d.configVersion;
    if (!configVersion) return null;

    if (configVersion.subDelegationBehavior === 'deny' && d.delegationLevel > 0) {
      return IdentityDelegationDeniedReason.sub_delegation_denied;
    }

    if (d.delegationLevel > configVersion.subDelegationDepth) {
      return IdentityDelegationDeniedReason.sub_delegation_depth_exceeded;
    }

    return null;
  }

  private async resolveCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identity: Identity;
    credentialIds: string[];
  }) {
    return withTransaction(
      async db => {
        let credentials = d.credentialIds.length
          ? await db.identityCredential.findMany({
              where: { id: { in: d.credentialIds } }
            })
          : [];
        for (let credential of credentials) {
          checkDeletedRelation(credential);
          if (credential.identityOid !== d.identity.oid) {
            throw new ServiceError(notFoundError('identity.credential', credential.id));
          }
        }

        let credentialMap = new Map(credentials.map(c => [c.id, c]));
        for (let credentialId of d.credentialIds) {
          if (!credentialMap.has(credentialId)) {
            throw new ServiceError(notFoundError('identity.credential', credentialId));
          }
        }

        return credentialMap;
      },
      { ifExists: true }
    );
  }
}

export let identityDelegationInternalService = Service.create(
  'identityDelegationInternal',
  () => new identityDelegationInternalServiceImpl()
).build();
