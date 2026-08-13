import { Paginator } from '@lowerdeck/pagination';
import { auditLogService } from '@metorial/module-audit-log';
import { auditLogPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';

export let auditLogManagementController = Controller.create(
  {
    name: 'Audit log',
    description: 'Read organization audit logs'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('audit-logs', 'audit_logs.list'), {
        name: 'List organization audit logs',
        description: 'List audit logs recorded for the organization'
      })
      .use(checkAccess({ possibleScopes: ['organization:read'] }))
      .outputList(auditLogPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await auditLogService.listAuditLogs({
          organizationId: ctx.organization.id
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, auditLog => auditLogPresenter.present({ auditLog }));
      }),

    get: organizationGroup
      .get(organizationManagementPath('audit-logs/:auditLogId', 'audit_logs.get'), {
        name: 'Get organization audit log',
        description: 'Get a specific audit log recorded for the organization'
      })
      .use(checkAccess({ possibleScopes: ['organization:read'] }))
      .output(auditLogPresenter)
      .do(async ctx => {
        let auditLog = await auditLogService.getAuditLog({
          organizationId: ctx.organization.id,
          auditLogId: ctx.params.auditLogId
        });

        return auditLogPresenter.present({ auditLog });
      })
  }
);
