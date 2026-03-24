import { delay } from '@lowerdeck/delay';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  db,
  type DelegatedIdentity,
  type DelegatedIdentityCredential,
  type Environment,
  type Identity,
  type IdentityActor,
  type IdentityCredential,
  IdentityDelegationPermissions,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { checkTenant } from '@metorial-subspace/module-tenant';

export interface DelegatedIdentityRequirements {
  permissions: IdentityDelegationPermissions[];
  expiresAt: Date | null;
}

export class DelegationChecker {
  #credentialMap: Map<bigint, DelegatedIdentityCredential> | null = null;

  private constructor(
    private readonly identity: Identity,
    private readonly delegated:
      | (DelegatedIdentity & {
          credentials: DelegatedIdentityCredential[];
        })
      | null
  ) {}

  static async create(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identity: Identity;
    actor: IdentityActor;
  }) {
    checkTenant(d, d.identity);

    let identity = d.identity;
    let i = 0;
    while (identity.needsReconciliation) {
      if (i++ > 50) {
        throw new ServiceError(
          badRequestError({
            message: 'Identity failed to reach a consistent state in time.'
          })
        );
      }
      identity = await db.identity.findUniqueOrThrow({
        where: { oid: identity.oid }
      });
      await delay(i > 10 ? 1000 : 100);
    }

    if (identity.status !== 'active') {
      return new DelegationChecker(d.identity, null);
    }

    let delegated = await db.delegatedIdentity.findUnique({
      where: {
        identityOid_actorOid: {
          identityOid: identity.oid,
          actorOid: d.actor.oid
        }
      },
      include: {
        credentials: {
          where: { isActive: true }
        }
      }
    });

    return new DelegationChecker(d.identity, delegated);
  }

  checkIdentity(requirements: DelegatedIdentityRequirements) {
    if (!this.delegated) return false;

    if (!this.checkExpiration(requirements, this.delegated)) return false;
    if (!this.checkPermissions(requirements, this.delegated)) return false;

    return true;
  }

  get delegationLevel() {
    return this.delegated?.delegationLevel ?? 0;
  }

  checkCredential(
    credential: IdentityCredential,
    requirements: DelegatedIdentityRequirements
  ) {
    if (!this.delegated) return false;

    let delegatedCredential = this.getCredentialMap().get(credential.oid);

    // If there is no credential override, the default setup of
    // the delegated identity applies.
    if (!delegatedCredential) return this.checkIdentity(requirements);

    if (!this.checkExpiration(requirements, delegatedCredential)) return false;
    if (!this.checkPermissions(requirements, delegatedCredential)) return false;

    return true;
  }

  async checkMany(d: {
    identityRequirements: DelegatedIdentityRequirements;
    credentials: {
      credential: IdentityCredential;
      requirements: DelegatedIdentityRequirements;
    }[];
  }) {
    if (!this.delegated) return false;

    if (!this.checkIdentity(d.identityRequirements)) return false;

    for (let { credential, requirements } of d.credentials) {
      if (!this.checkCredential(credential, requirements)) return false;
    }

    return true;
  }

  private checkExpiration(
    requirements: DelegatedIdentityRequirements,
    entity: DelegatedIdentity | DelegatedIdentityCredential
  ) {
    // If the entity doesn't have an expiration -> it can be used forever
    if (requirements.expiresAt && !entity.atLeastHoldsUntil) return true;

    // If the entity has an expiration, but the requirements don't -> the entity can't be used
    if (!requirements.expiresAt && entity.atLeastHoldsUntil) return false;

    // If both have an expiration, check if the entity's expiration is after the requirements' expiration
    if (requirements.expiresAt && entity.atLeastHoldsUntil) {
      return entity.atLeastHoldsUntil >= requirements.expiresAt;
    }

    // If neither have an expiration -> they are valid
    return true;
  }

  private checkPermissions(
    requirements: DelegatedIdentityRequirements,
    entity: DelegatedIdentity | DelegatedIdentityCredential
  ) {
    return requirements.permissions.every(p => entity.permissions.includes(p));
  }

  private getCredentialMap(): Map<bigint, DelegatedIdentityCredential> {
    if (!this.delegated) return new Map();

    if (!this.#credentialMap) {
      this.#credentialMap = new Map(this.delegated.credentials.map(c => [c.credentialOid, c]));
    }

    return this.#credentialMap;
  }
}
