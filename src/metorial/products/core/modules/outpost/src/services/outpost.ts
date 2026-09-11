import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { db, ID, Organization, Outpost, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { accountService } from '@metorial/module-organization';
import { accountFamilyWhere, rootAccountOidOf } from '../lib/accountFamily';

class OutpostService {
  private ensureOutpostActive(outpost: Outpost) {
    if (outpost.status != 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a disabled or deleted outpost'
        })
      );
    }
  }

  async createOutpost(d: {
    organization: Organization;
    input: { name: string; description?: string };
    auditScope: AuditScope;
  }) {
    let account = await accountService.getAccountForOrganization({
      organization: d.organization
    });

    return await withTransaction(async db => {
      await Fabric.fire('outpost.created:before', d);

      let outpost = await db.outpost.create({
        data: {
          id: await ID.generateId('outpost'),
          status: 'active',
          connectionStatus: 'inactive',
          accountOid: account.oid,
          organizationOid: d.organization.oid,
          name: d.input.name,
          description: d.input.description
        },
        include: { organization: true }
      });

      await Fabric.fire('outpost.created:after', { ...d, outpost });

      return outpost;
    });
  }

  async getOutpostInFamily(d: { organization: Organization; outpostId: string }) {
    let account = await accountService.getAccountForOrganization({
      organization: d.organization
    });

    let outpost = await db.outpost.findFirst({
      where: {
        id: d.outpostId,
        status: { not: 'deleted' },
        account: accountFamilyWhere(rootAccountOidOf(account))
      },
      include: { organization: true }
    });
    if (!outpost) throw new ServiceError(notFoundError('outpost', d.outpostId));

    return outpost;
  }

  async listOutpostsInFamily(d: { organization: Organization }) {
    let account = await accountService.getAccountForOrganization({
      organization: d.organization
    });
    let rootAccountOid = rootAccountOidOf(account);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.outpost.findMany({
            ...opts,
            where: {
              status: { not: 'deleted' },
              account: accountFamilyWhere(rootAccountOid)
            },
            include: { organization: true }
          })
      )
    );
  }

  async getOwnedOutpostById(d: { organization: Organization; outpostId: string }) {
    let outpost = await db.outpost.findFirst({
      where: {
        id: d.outpostId,
        organizationOid: d.organization.oid,
        status: { not: 'deleted' }
      },
      include: { organization: true }
    });
    if (!outpost) throw new ServiceError(notFoundError('outpost', d.outpostId));

    return outpost;
  }

  async updateOutpost(d: {
    outpost: Outpost;
    organization: Organization;
    input: { name?: string; description?: string };
    auditScope: AuditScope;
  }) {
    this.ensureOutpostActive(d.outpost);

    return await withTransaction(async db => {
      await Fabric.fire('outpost.updated:before', d);

      let outpost = await db.outpost.update({
        where: { oid: d.outpost.oid },
        data: {
          name: d.input.name,
          description: d.input.description
        },
        include: { organization: true }
      });

      await Fabric.fire('outpost.updated:after', {
        ...d,
        outpost,
        previousOutpost: d.outpost
      });

      return outpost;
    });
  }

  async disableOutpost(d: {
    outpost: Outpost;
    organization: Organization;
    auditScope: AuditScope;
  }) {
    this.ensureOutpostActive(d.outpost);

    return await withTransaction(async db => {
      await Fabric.fire('outpost.disabled:before', d);

      let outpost = await db.outpost.update({
        where: { oid: d.outpost.oid },
        data: { status: 'disabled' },
        include: { organization: true }
      });

      await Fabric.fire('outpost.disabled:after', {
        ...d,
        outpost,
        previousOutpost: d.outpost
      });

      return outpost;
    });
  }

  async enableOutpost(d: {
    outpost: Outpost;
    organization: Organization;
    auditScope: AuditScope;
  }) {
    if (d.outpost.status != 'disabled') {
      throw new ServiceError(
        forbiddenError({
          message: 'Only a disabled outpost can be enabled'
        })
      );
    }

    return await withTransaction(async db => {
      await Fabric.fire('outpost.enabled:before', d);

      let outpost = await db.outpost.update({
        where: { oid: d.outpost.oid },
        data: { status: 'active' },
        include: { organization: true }
      });

      await Fabric.fire('outpost.enabled:after', {
        ...d,
        outpost,
        previousOutpost: d.outpost
      });

      return outpost;
    });
  }

  async deleteOutpost(d: {
    outpost: Outpost;
    organization: Organization;
    auditScope: AuditScope;
  }) {
    if (d.outpost.status != 'disabled') {
      throw new ServiceError(
        forbiddenError({
          message: 'Outpost must be disabled before it can be deleted'
        })
      );
    }

    return await withTransaction(async db => {
      await Fabric.fire('outpost.deleted:before', d);

      let outpost = await db.outpost.update({
        where: { oid: d.outpost.oid },
        data: { status: 'deleted' },
        include: { organization: true }
      });

      await Fabric.fire('outpost.deleted:after', {
        ...d,
        outpost,
        previousOutpost: d.outpost
      });

      return outpost;
    });
  }
}

export let outpostService = Service.create(
  'outpostService',
  () => new OutpostService()
).build();
