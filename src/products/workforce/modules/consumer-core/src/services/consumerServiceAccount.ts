import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  db,
  OAuthApplication,
  OAuthSubjectType,
  Organization,
  Portal,
  ServiceAccount
} from '@metorial/db';
import { serviceAccountService } from '@metorial/module-machine-access';
import { consumerProfileService } from './consumerProfile';

class ConsumerServiceAccountServiceImpl {
  async createConsumerServiceAccount(d: {
    organization: Organization;
    portal: Portal;
    auditScope: AuditScope;
    input: {
      name: string;
      description?: string;
      scopes: string[];
    };
  }) {
    let surface = await db.consumerSurface.findFirst({
      where: {
        oid: d.portal.surfaceOid,
        organizationOid: d.organization.oid,
        type: 'portal',
        status: 'active'
      }
    });

    if (
      !surface ||
      d.portal.organizationOid != d.organization.oid ||
      d.portal.status != 'active'
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Consumer service accounts require an active portal in this organization.'
        })
      );
    }

    let consumerProfile = await consumerProfileService.createServiceAccountConsumerProfile({
      surface,
      name: d.input.name,
      serviceAccountKey: generatePlainId(),
      auditScope: d.auditScope
    });

    try {
      return await serviceAccountService.createServiceAccount({
        organization: d.organization,
        auditScope: d.auditScope,
        input: d.input,
        consumer: {
          portal: d.portal,
          consumerProfile
        }
      });
    } catch (err) {
      await consumerProfileService.deleteConsumerProfile({
        consumerProfile,
        auditScope: d.auditScope
      });

      throw err;
    }
  }

  async archiveConsumerServiceAccount(d: {
    serviceAccount: ServiceAccount & {
      oauthApplication: OAuthApplication;
    };
    organization: Organization;
    auditScope: AuditScope;
  }) {
    let serviceAccount = await serviceAccountService.archiveServiceAccount(d);

    if (d.serviceAccount.consumerProfileOid) {
      await consumerProfileService.deleteServiceAccountConsumerProfile({
        consumerProfile: { oid: d.serviceAccount.consumerProfileOid },
        auditScope: d.auditScope
      });
    }

    return serviceAccount;
  }

  async createServiceAccountForSubject(d: {
    organization: Organization;
    auditScope: AuditScope;
    input: {
      subjectType?: OAuthSubjectType;
      portalId?: string;
      name: string;
      description?: string;
      scopes: string[];
    };
  }) {
    let { subjectType, portalId, ...input } = d.input;

    if (subjectType != 'consumer') {
      if (portalId) {
        throw new ServiceError(
          badRequestError({
            message: 'portal_id is only supported for consumer service accounts.'
          })
        );
      }

      return await serviceAccountService.createServiceAccount({
        organization: d.organization,
        auditScope: d.auditScope,
        input
      });
    }

    if (!portalId) {
      throw new ServiceError(
        badRequestError({
          message: 'portal_id is required for consumer service accounts.'
        })
      );
    }

    let portal = await db.portal.findFirst({
      where: {
        id: portalId,
        organizationOid: d.organization.oid
      }
    });
    if (!portal) throw new ServiceError(notFoundError('portal', portalId));

    return await this.createConsumerServiceAccount({
      organization: d.organization,
      portal,
      auditScope: d.auditScope,
      input
    });
  }

  async archiveServiceAccountForSubject(d: {
    serviceAccount: ServiceAccount & {
      oauthApplication: OAuthApplication;
    };
    organization: Organization;
    auditScope: AuditScope;
  }) {
    if (d.serviceAccount.subjectType == 'consumer') {
      return await this.archiveConsumerServiceAccount(d);
    }

    return await serviceAccountService.archiveServiceAccount(d);
  }
}

export let consumerServiceAccountService = Service.create(
  'consumerServiceAccountService',
  () => new ConsumerServiceAccountServiceImpl()
).build();
