import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  type Firewall,
  type IntegrationFirewallAssignment,
  type FirewallStatus,
  getId,
  type IntegrationInternetGateway,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForList,
  resolveEnclaves,
  resolveFirewalls,
  resolveInternetGateways,
  resolveProviders
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import {
  type FirewallAssignmentInput,
  validateFirewallAssignmentInput,
  validateFirewallAssignmentInputs
} from '../lib/firewallAssignmentValidation';
import {
  firewallAssignmentCreatedQueue,
  firewallAssignmentDeletedQueue,
  type FirewallAssignmentLifecycleTarget
} from '../queues/lifecycle/firewallAssignment';

export type { FirewallAssignmentInput };

export let assignmentInclude = {
  firewall: {
    select: {
      id: true,
      slug: true,
      name: true
    }
  },
  enclave: {
    select: {
      id: true,
      slug: true,
      name: true
    }
  },
  provider: {
    select: {
      id: true,
      slug: true,
      name: true,
      prettySlug: true
    }
  },
  internetGateway: {
    select: {
      id: true,
      name: true
    }
  }
};

export type CreateFirewallAssignmentParams = {
  tenant: Tenant;
  environment: Environment;
  firewallId: string;
  input: FirewallAssignmentInput;
};

export type DeleteFirewallAssignmentParams = {
  tenant: Tenant;
  environment: Environment;
  firewallAssignment: IntegrationFirewallAssignment;
};

type ListFirewallAssignmentsParams = {
  status?: FirewallStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  firewallIds?: string[];
  enclaveIds?: string[];
  providerIds?: string[];
  internetGatewayIds?: string[];
  targetTypes?: IntegrationFirewallAssignment['targetType'][];
  createdAt?: DateFilter;
};

type GetFirewallAssignmentByIdParams = {
  firewallAssignmentId: string;
};

type CreateFirewallAssignmentsParams = {
  firewall: Firewall;
  internetGateway: IntegrationInternetGateway;
  assignments: FirewallAssignmentInput[];
};

class IntegrationFirewallAssignmentServiceImpl {
  async createFirewallAssignment(d: MetorialFacing<CreateFirewallAssignmentParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire(
      'instance.network.integration_firewall_assignment.created:before',
      eventBase
    );

    let firewallAssignment = await this.createFirewallAssignmentInternal({
      ...rest,
      tenant,
      environment
    });

    await Fabric.fire('instance.network.integration_firewall_assignment.created:after', {
      ...eventBase,
      firewallAssignment
    });

    return firewallAssignment;
  }

  async deleteFirewallAssignment(d: MetorialFacing<DeleteFirewallAssignmentParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire(
      'instance.network.integration_firewall_assignment.deleted:before',
      eventBase
    );

    let firewallAssignment = await this.deleteFirewallAssignmentInternal({
      ...rest,
      tenant,
      environment
    });

    await Fabric.fire('instance.network.integration_firewall_assignment.deleted:after', {
      ...eventBase,
      firewallAssignment
    });

    return firewallAssignment;
  }

  async listFirewallAssignments(d: MetorialFacing<ListFirewallAssignmentsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listFirewallAssignmentsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listFirewallAssignmentsInternal(
    d: { tenant: Tenant; environment: Environment } & ListFirewallAssignmentsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let firewalls = await resolveFirewalls(ts, d.firewallIds);
    let enclaves = await resolveEnclaves(ts, d.enclaveIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let internetGateways = await resolveInternetGateways(ts, d.internetGatewayIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.integrationFirewallAssignment.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            firewall: normalizeStatusForList<FirewallStatus>(d).noParent,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              firewalls ? { firewallOid: firewalls.in } : undefined!,
              enclaves ? { enclaveOid: enclaves.in } : undefined!,
              providers ? { providerOid: providers.in } : undefined!,
              internetGateways
                ? {
                    OR: [
                      { internetGatewayOid: internetGateways.in },
                      { firewall: { internetGatewayOid: internetGateways.in } }
                    ]
                  }
                : undefined!,
              d.targetTypes ? { targetType: { in: d.targetTypes } } : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
            ].filter(Boolean)
          },
          include: assignmentInclude,
          orderBy: { createdAt: 'desc' }
        })
      )
    );
  }

  async getFirewallAssignmentById(d: MetorialFacing<GetFirewallAssignmentByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getFirewallAssignmentByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getFirewallAssignmentByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetFirewallAssignmentByIdParams
  ) {
    let assignment = await db.integrationFirewallAssignment.findFirst({
      where: {
        id: d.firewallAssignmentId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include: assignmentInclude
    });
    if (!assignment) {
      throw new ServiceError(notFoundError('firewall.assignment', d.firewallAssignmentId));
    }

    return assignment;
  }

  async createFirewallAssignmentInternal(d: CreateFirewallAssignmentParams) {
    validateFirewallAssignmentInput(d.input);

    return withTransaction(async db => {
      let firewall = await db.firewall.findFirst({
        where: {
          id: d.firewallId,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        include: {
          internetGateway: true
        }
      });
      if (!firewall) {
        throw new ServiceError(notFoundError('firewall', d.firewallId));
      }
      checkDeletedRelation(firewall);

      return this.createAssignment({
        tenant: d.tenant,
        environment: d.environment,
        firewall,
        internetGateway: firewall.internetGateway,
        assignment: d.input
      });
    });
  }

  async createFirewallAssignments(
    d: MetorialFacing<{ firewall: Firewall; assignments: FirewallAssignmentInput[] }>
  ) {
    let { tenant, environment } = await resolveMetorialFacing(d);
    let internetGateway = await db.integrationInternetGateway.findFirstOrThrow({
      where: { oid: d.firewall.internetGatewayOid }
    });

    return await this.createFirewallAssignmentsInternal({
      tenant,
      environment,
      firewall: d.firewall,
      internetGateway,
      assignments: d.assignments
    });
  }

  async createFirewallAssignmentsInternal(
    d: { tenant: Tenant; environment: Environment } & CreateFirewallAssignmentsParams
  ) {
    validateFirewallAssignmentInputs(d.assignments);
    checkDeletedRelation(d.firewall);

    return withTransaction(
      async () => {
        for (let assignment of d.assignments) {
          await this.createAssignment({
            tenant: d.tenant,
            environment: d.environment,
            firewall: d.firewall,
            internetGateway: d.internetGateway,
            assignment
          });
        }
      },
      { ifExists: true }
    );
  }

  async deleteFirewallAssignmentInternal(d: DeleteFirewallAssignmentParams) {
    checkTenant(d, d.firewallAssignment);

    return withTransaction(async db => {
      let assignment = await db.integrationFirewallAssignment.findFirst({
        where: {
          oid: d.firewallAssignment.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        include: {
          firewall: {
            select: {
              internetGatewayOid: true
            }
          }
        }
      });
      if (!assignment) {
        throw new ServiceError(notFoundError('firewall.assignment', d.firewallAssignment.id));
      }

      let deleted = await db.integrationFirewallAssignment.delete({
        where: { oid: d.firewallAssignment.oid },
        include: assignmentInclude
      });

      await addAfterTransactionHook(async () =>
        firewallAssignmentDeletedQueue.add(
          toFirewallAssignmentLifecycleTarget({
            assignment,
            firewallInternetGatewayOid: assignment.firewall.internetGatewayOid
          })
        )
      );

      return deleted;
    });
  }

  private async createAssignment(d: {
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall;
    internetGateway: IntegrationInternetGateway;
    assignment: FirewallAssignmentInput;
  }) {
    return withTransaction(
      async db => {
        checkDeletedRelation(d.firewall);

        let data = await this.resolveAssignmentTarget({
          tenant: d.tenant,
          environment: d.environment,
          internetGateway: d.internetGateway,
          assignment: d.assignment
        });

        let existing = await db.integrationFirewallAssignment.findFirst({
          where: {
            firewallOid: d.firewall.oid,
            ...(d.assignment.targetType === 'enclave'
              ? { enclaveOid: data.enclaveOid }
              : d.assignment.targetType === 'provider'
                ? { providerOid: data.providerOid }
                : { internetGatewayOid: data.internetGatewayOid })
          },
          include: assignmentInclude
        });
        if (existing) return existing;

        let created = await db.integrationFirewallAssignment.create({
          data: {
            ...getId('integrationFirewallAssignment'),
            firewallOid: d.firewall.oid,
            targetType: d.assignment.targetType,
            enclaveOid: data.enclaveOid,
            providerOid: data.providerOid,
            internetGatewayOid: data.internetGatewayOid,
            tenantOid: d.tenant.oid,
            projectOid: d.tenant.projectOid,
            environmentOid: d.environment.oid,
            instanceOid: d.environment.instanceOid
          },
          include: assignmentInclude
        });

        await addAfterTransactionHook(async () =>
          firewallAssignmentCreatedQueue.add({ firewallAssignmentId: created.id })
        );

        return created;
      },
      { ifExists: true }
    );
  }

  private async resolveAssignmentTarget(d: {
    tenant: Tenant;
    environment: Environment;
    internetGateway: IntegrationInternetGateway;
    assignment: FirewallAssignmentInput;
  }) {
    return withTransaction(
      async db => {
        if (d.assignment.targetType === 'enclave') {
          let enclave = await db.integrationEnclave.findFirst({
            where: {
              id: d.assignment.enclaveId,
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid
            }
          });
          if (!enclave) {
            throw new ServiceError(notFoundError('enclave', d.assignment.enclaveId));
          }
          if (enclave.internetGatewayOid !== d.internetGateway.oid) {
            throw new ServiceError(
              badRequestError({
                code: 'invalid_firewall_assignment',
                message: `Enclave "${d.assignment.enclaveId}" does not belong to the firewall internet gateway.`
              })
            );
          }

          return { enclaveOid: enclave.oid, providerOid: null, internetGatewayOid: null };
        }

        if (d.assignment.targetType === 'provider') {
          let providerUse = await db.providerUse.findFirst({
            where: {
              provider: { id: d.assignment.providerId },
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid
            },
            include: {
              provider: true
            }
          });
          if (!providerUse) {
            throw new ServiceError(notFoundError('provider', d.assignment.providerId));
          }

          return {
            enclaveOid: null,
            providerOid: providerUse.providerOid,
            internetGatewayOid: null
          };
        }

        return {
          enclaveOid: null,
          providerOid: null,
          internetGatewayOid: d.internetGateway.oid
        };
      },
      { ifExists: true }
    );
  }
}

let toFirewallAssignmentLifecycleTarget = (d: {
  assignment: Pick<
    IntegrationFirewallAssignment,
    'tenantOid' | 'environmentOid' | 'enclaveOid' | 'providerOid' | 'internetGatewayOid'
  >;
  firewallInternetGatewayOid: bigint;
}): FirewallAssignmentLifecycleTarget => ({
  firewallInternetGatewayOid: d.firewallInternetGatewayOid.toString(),
  tenantOid: d.assignment.tenantOid.toString(),
  environmentOid: d.assignment.environmentOid.toString(),
  enclaveOid: d.assignment.enclaveOid?.toString() ?? null,
  providerOid: d.assignment.providerOid?.toString() ?? null,
  assignmentInternetGatewayOid: d.assignment.internetGatewayOid?.toString() ?? null
});

export let integrationFirewallAssignmentService = Service.create(
  'integrationFirewallAssignmentService',
  () => new IntegrationFirewallAssignmentServiceImpl()
).build();
