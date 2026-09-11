import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { Organization, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';

class AuditLogRetentionService {
  private ensureOrganizationActive(organization: Organization) {
    if (organization.status !== 'active') {
      throw new ServiceError(
        forbiddenError({ message: 'Cannot perform this action on a deleted organization' })
      );
    }
  }

  async getAuditLogRetention(d: { organization: Organization }) {
    this.ensureOrganizationActive(d.organization);

    return d.organization;
  }

  async updateAuditLogRetention(d: {
    organization: Organization;
    auditScope: AuditScope;
    input: { auditLogRetentionInDays: number };
  }) {
    this.ensureOrganizationActive(d.organization);

    return await withTransaction(async db => {
      await Fabric.fire('organization.audit_log_retention.updated:before', d);

      let organization = await db.organization.update({
        where: { oid: d.organization.oid },
        data: { auditLogRetentionInDays: d.input.auditLogRetentionInDays }
      });

      await Fabric.fire('organization.audit_log_retention.updated:after', {
        organization,
        previousOrganization: d.organization,
        auditScope: d.auditScope,
        input: d.input
      });

      return organization;
    });
  }
}

export let auditLogRetentionService = Service.create(
  'auditLogRetentionService',
  () => new AuditLogRetentionService()
).build();
