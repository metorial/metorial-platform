import { Service } from '@lowerdeck/service';
import {
  AccessPolicy,
  AccessPolicyAssignment,
  AccessPolicyRole,
  AccessRole,
  db,
  Instance,
  Organization,
  OrganizationMember,
  Project,
  ServiceAccount
} from '@metorial/db';
import { normalizePolicyDocument, PolicyDocument } from '../lib/accessControl';

let effectiveAccessAssignmentInclude = {
  accessPolicy: {
    include: {
      accessPolicyRoles: {
        include: {
          accessRole: true
        }
      }
    }
  }
} as const;

type AccessPolicyWithRoles = AccessPolicy & {
  accessPolicyRoles: (AccessPolicyRole & { accessRole: AccessRole })[];
};

type AccessPolicyAssignmentWithPolicy = AccessPolicyAssignment & {
  accessPolicy: AccessPolicyWithRoles;
};

type EffectiveAccessEntry = {
  target: string;
  scopes: string[];
  accessPolicyId: string;
};

type EffectiveAccess = {
  entries: EffectiveAccessEntry[];
};

type AccessTarget =
  | {
      type: 'organization';
      organization: Pick<Organization, 'id'>;
    }
  | {
      type: 'project';
      organization: Pick<Organization, 'id'>;
      project: Pick<Project, 'id'>;
    }
  | {
      type: 'instance';
      organization: Pick<Organization, 'id'>;
      project: Pick<Project, 'id'>;
      instance: Pick<Instance, 'id'>;
    };

let unique = <T>(items: T[]) => [...new Set(items)];

let dedupeAssignments = (assignments: AccessPolicyAssignmentWithPolicy[]) => {
  let byPolicy = new Map<bigint, AccessPolicyAssignmentWithPolicy>();

  for (let assignment of assignments) {
    byPolicy.set(assignment.accessPolicyOid, assignment);
  }

  return [...byPolicy.values()];
};

let dedupeEntries = (entries: EffectiveAccessEntry[]) => {
  let byKey = new Map<string, EffectiveAccessEntry>();

  for (let entry of entries) {
    byKey.set(`${entry.accessPolicyId}:${entry.target}:${entry.scopes.join(',')}`, entry);
  }

  return [...byKey.values()];
};

let getEntryScopes = (d: {
  accessPolicy: AccessPolicyWithRoles;
  entry: PolicyDocument['access'][0];
}) => {
  let roleLookup = new Map<string, AccessRole>();

  for (let accessPolicyRole of d.accessPolicy.accessPolicyRoles) {
    roleLookup.set(accessPolicyRole.accessRole.id, accessPolicyRole.accessRole);
    roleLookup.set(accessPolicyRole.accessRole.slug, accessPolicyRole.accessRole);
  }

  return unique([
    ...(d.entry.scopes ?? []),
    ...(d.entry.roles ?? []).flatMap(roleId => roleLookup.get(roleId)?.scopes ?? [])
  ]);
};

let resolvePolicyEntries = (accessPolicy: AccessPolicyWithRoles): EffectiveAccessEntry[] => {
  let document = normalizePolicyDocument(accessPolicy.document as PolicyDocument);

  return document.access
    .map(entry => ({
      target: entry.target,
      scopes: getEntryScopes({ accessPolicy, entry }),
      accessPolicyId: accessPolicy.id
    }))
    .filter(entry => entry.scopes.length > 0);
};

let doesEntryApplyToTarget = (d: {
  target: AccessTarget;
  policyEntry: EffectiveAccessEntry;
}) => {
  if (d.target.type == 'organization') {
    return d.policyEntry.target == d.target.organization.id;
  }

  if (d.target.type == 'project') {
    return (
      d.policyEntry.target == d.target.organization.id ||
      d.policyEntry.target == d.target.project.id
    );
  }

  return (
    d.policyEntry.target == d.target.organization.id ||
    d.policyEntry.target == d.target.project.id ||
    d.policyEntry.target == d.target.instance.id
  );
};

class EffectiveAccessService {
  private async getMemberAssignments(d: {
    organization: Organization;
    member: Pick<OrganizationMember, 'oid' | 'actorOid'>;
  }) {
    return dedupeAssignments(
      await db.accessPolicyAssignment.findMany({
        where: {
          accessPolicy: {
            organizationOid: d.organization.oid
          },
          OR: [
            {
              memberOid: d.member.oid
            },
            {
              team: {
                members: {
                  some: {
                    organizationActorOid: d.member.actorOid
                  }
                }
              }
            }
          ]
        },
        include: effectiveAccessAssignmentInclude
      })
    );
  }

  private async getServiceAccountAssignments(d: {
    organization: Organization;
    serviceAccount: Pick<ServiceAccount, 'oid'>;
  }) {
    return dedupeAssignments(
      await db.accessPolicyAssignment.findMany({
        where: {
          accessPolicy: {
            organizationOid: d.organization.oid
          },
          serviceAccountOid: d.serviceAccount.oid
        },
        include: effectiveAccessAssignmentInclude
      })
    );
  }

  private buildEffectiveAccess(
    assignments: AccessPolicyAssignmentWithPolicy[]
  ): EffectiveAccess {
    return {
      entries: dedupeEntries(
        assignments.flatMap(assignment => resolvePolicyEntries(assignment.accessPolicy))
      )
    };
  }

  async getMemberEffectiveAccess(d: {
    organization: Organization;
    member: Pick<OrganizationMember, 'oid' | 'actorOid'>;
  }) {
    return this.buildEffectiveAccess(await this.getMemberAssignments(d));
  }

  async getServiceAccountEffectiveAccess(d: {
    organization: Organization;
    serviceAccount: Pick<ServiceAccount, 'oid'>;
  }) {
    return this.buildEffectiveAccess(await this.getServiceAccountAssignments(d));
  }

  getScopesForTarget(d: { effectiveAccess: EffectiveAccess; target: AccessTarget }) {
    return unique(
      d.effectiveAccess.entries
        .filter(policyEntry => doesEntryApplyToTarget({ target: d.target, policyEntry }))
        .flatMap(policyEntry => policyEntry.scopes)
    );
  }

  getGrantedScopes(d: { effectiveAccess: EffectiveAccess }) {
    return unique(d.effectiveAccess.entries.flatMap(entry => entry.scopes));
  }
}

export let effectiveAccessService = Service.create(
  'effectiveAccessService',
  () => new EffectiveAccessService()
).build();
