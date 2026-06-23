import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import type { AccessGroup, App, User } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

let include = {
  rules: true,
  assignments: {
    include: {
      app: { select: { id: true, clientId: true } }
    }
  }
};

class AccessGroupServiceImpl {
  async get(d: { accessGroupId: string }) {
    let accessGroup = await db.accessGroup.findUnique({
      where: { id: d.accessGroupId },
      include
    });
    if (!accessGroup) throw new ServiceError(notFoundError('accessGroup'));
    return accessGroup;
  }

  async list(d: { app: App }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.accessGroup.findMany({
            ...opts,
            where: { appOid: d.app.oid },
            include
          })
      )
    );
  }

  async create(d: {
    app: App;
    input: { name: string; rules: { type: string; value: string }[] };
  }) {
    return await db.accessGroup.create({
      data: {
        ...getId('accessGroup'),
        appOid: d.app.oid,
        name: d.input.name,
        rules: {
          create: d.input.rules.map(rule => ({
            ...getId('accessGroupRule'),
            type: rule.type,
            value: rule.value
          }))
        }
      },
      include
    });
  }

  async update(d: {
    accessGroup: AccessGroup;
    input: { name?: string; rules?: { type: string; value: string }[] };
  }) {
    if (d.input.rules) {
      await db.accessGroupRule.deleteMany({
        where: { accessGroupOid: d.accessGroup.oid }
      });

      await db.accessGroupRule.createMany({
        data: d.input.rules.map(rule => ({
          ...getId('accessGroupRule'),
          accessGroupOid: d.accessGroup.oid,
          type: rule.type,
          value: rule.value
        }))
      });
    }

    return await db.accessGroup.update({
      where: { oid: d.accessGroup.oid },
      data: { name: d.input.name ?? undefined },
      include
    });
  }

  async delete(d: { accessGroup: AccessGroup }) {
    await db.accessGroup.delete({ where: { oid: d.accessGroup.oid } });
  }

  async assignToApp(d: { accessGroup: AccessGroup; app: App }) {
    return await db.accessGroupAssignment.create({
      data: {
        ...getId('accessGroupAssignment'),
        accessGroupOid: d.accessGroup.oid,
        appOid: d.app.oid
      }
    });
  }

  async unassign(d: { assignmentId: string }) {
    let assignment = await db.accessGroupAssignment.findUnique({
      where: { id: d.assignmentId }
    });
    if (!assignment) throw new ServiceError(notFoundError('accessGroupAssignment'));
    await db.accessGroupAssignment.delete({ where: { oid: assignment.oid } });
  }

  async listAssignmentsForApp(d: { app: App }) {
    return await db.accessGroupAssignment.findMany({
      where: { appOid: d.app.oid },
      include: {
        accessGroup: {
          include: { _count: { select: { rules: true } } }
        }
      }
    });
  }

  async checkAppAccess(d: { user: User; app: App } | { user: User; appOid: bigint }): Promise<boolean> {
    let appOid = 'app' in d ? d.app.oid : d.appOid;

    let assignments = await db.accessGroupAssignment.findMany({
      where: { appOid },
      include: { accessGroup: { include: { rules: true } } }
    });

    if (assignments.length === 0) return true;

    for (let assignment of assignments) {
      let matched = await this._checkRules({
        user: d.user,
        rules: assignment.accessGroup.rules,
        appOid
      });
      if (matched) return true;
    }

    return false;
  }

  async checkAccess(d: { user: User; accessGroupId: string }): Promise<boolean> {
    let accessGroup = await db.accessGroup.findUnique({
      where: { id: d.accessGroupId },
      include: { rules: true }
    });
    if (!accessGroup) return false;

    return this._checkRules({
      user: d.user,
      rules: accessGroup.rules,
      appOid: accessGroup.appOid
    });
  }

  private async _checkRules(d: {
    user: User;
    rules: { type: string; value: string }[];
    appOid: bigint;
  }): Promise<boolean> {
    if (d.rules.length === 0) return false;

    let rulesByType = new Map<string, string[]>();
    for (let rule of d.rules) {
      let values = rulesByType.get(rule.type);
      if (!values) {
        values = [];
        rulesByType.set(rule.type, values);
      }
      values.push(rule.value);
    }

    let emailValues = rulesByType.get('email');
    if (emailValues) {
      let match = await db.userEmail.findFirst({
        where: {
          userOid: d.user.oid,
          verifiedAt: { not: null },
          email: { in: emailValues }
        }
      });
      if (match) return true;
    }

    let domainValues = rulesByType.get('email_domain');
    if (domainValues) {
      let match = await db.userEmail.findFirst({
        where: {
          userOid: d.user.oid,
          verifiedAt: { not: null },
          domain: { domain: { in: domainValues } }
        }
      });
      if (match) return true;
    }

    let ssoRuleTypes = ['sso_tenant', 'sso_group', 'sso_role'];
    let hasSsoRules = ssoRuleTypes.some(t => rulesByType.has(t));

    if (hasSsoRules) {
      let emails = await db.userEmail.findMany({
        where: { userOid: d.user.oid, verifiedAt: { not: null } }
      });
      let emailAddresses = emails.map(e => e.email);
      if (emailAddresses.length === 0) return false;

      let tenants = await db.ssoTenant.findMany({
        where: { OR: [{ appOid: d.appOid }, { isGlobal: true }] },
        select: { oid: true }
      });
      let tenantOids = tenants.map(t => t.oid);
      if (tenantOids.length === 0) return false;

      let ssoTenantValues = rulesByType.get('sso_tenant');
      if (ssoTenantValues) {
        let matchingTenants = await db.ssoTenant.findMany({
          where: {
            OR: [{ appOid: d.appOid }, { isGlobal: true }],
            id: { in: ssoTenantValues }
          },
          select: { oid: true }
        });
        if (matchingTenants.length > 0) {
          let match = await db.ssoUserProfile.findFirst({
            where: {
              tenantOid: { in: matchingTenants.map(t => t.oid) },
              email: { in: emailAddresses }
            }
          });
          if (match) return true;
        }
      }

      let ssoGroupValues = rulesByType.get('sso_group');
      if (ssoGroupValues) {
        let match = await db.ssoUserProfile.findFirst({
          where: {
            tenantOid: { in: tenantOids },
            email: { in: emailAddresses },
            groups: { hasSome: ssoGroupValues }
          }
        });
        if (match) return true;
      }

      let ssoRoleValues = rulesByType.get('sso_role');
      if (ssoRoleValues) {
        let match = await db.ssoUserProfile.findFirst({
          where: {
            tenantOid: { in: tenantOids },
            email: { in: emailAddresses },
            roles: { hasSome: ssoRoleValues }
          }
        });
        if (match) return true;
      }
    }

    return false;
  }
}

export let accessGroupService = new AccessGroupServiceImpl();
