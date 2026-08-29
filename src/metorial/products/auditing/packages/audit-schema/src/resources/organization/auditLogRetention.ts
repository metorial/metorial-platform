import { v } from '@lowerdeck/validation';
import { Organization } from '@metorial/db';
import { organizationAuditLogRetentionPresenter } from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let auditLogRetentionResource = resource({
  name: 'audit_log_retention',
  payload: v.typedAny<{
    organization: Organization;
  }>('audit_log_retention'),
  presenter: organizationAuditLogRetentionPresenter,
  actions: {
    update: true
  }
});
