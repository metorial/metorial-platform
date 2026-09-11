import { v } from '@lowerdeck/validation';
import { auditLogRetentionService } from '@metorial/module-audit-log';
import { organizationAuditLogRetentionPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';

export let dashboardAuditLogRetentionController = Controller.create(
  {
    name: 'Organization audit log retention',
    description: 'Configure organization audit log retention'
  },
  {
    get: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/configure/audit-log-retention',
          'dashboard.organizations.configure.audit_log_retention.get'
        ),
        {
          name: 'Get audit log retention configuration',
          description: 'Get the audit log retention period for an organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization:read'] }))
      .output(organizationAuditLogRetentionPresenter)
      .do(async ctx => {
        let organization = await auditLogRetentionService.getAuditLogRetention({
          organization: ctx.organization
        });

        return organizationAuditLogRetentionPresenter.present({ organization });
      }),

    update: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/configure/audit-log-retention',
          'dashboard.organizations.configure.audit_log_retention.update'
        ),
        {
          name: 'Update audit log retention configuration',
          description: 'Update the audit log retention period for an organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization:write'] }))
      .body(
        'default',
        v.object({
          audit_log_retention_in_days: v.number({
            modifiers: [v.positive(), v.integer(), v.minValue(1), v.maxValue(2_147_483_647)]
          })
        })
      )
      .output(organizationAuditLogRetentionPresenter)
      .do(async ctx => {
        let organization = await auditLogRetentionService.updateAuditLogRetention({
          organization: ctx.organization,
          auditScope: ctx.auditScope,
          input: {
            auditLogRetentionInDays: ctx.body.audit_log_retention_in_days
          }
        });

        return organizationAuditLogRetentionPresenter.present({ organization });
      })
  }
);
