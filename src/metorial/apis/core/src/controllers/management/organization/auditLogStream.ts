import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { db } from '@metorial/db';
import { auditLogStreamService } from '@metorial/module-audit-log-stream';
import { auditLogStreamPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';

export let auditLogStreamManagementGroup = organizationGroup.use(async ctx => {
  if (!ctx.params.auditLogStreamId) {
    throw new ServiceError(
      badRequestError({
        message: 'auditLogStreamId is required',
        description: 'The auditLogStreamId path parameter is required.'
      })
    );
  }

  let auditLogStream = await db.auditLogStream.findFirst({
    where: {
      id: ctx.params.auditLogStreamId,
      organizationOid: ctx.organization.oid
    },
    include: { organization: true }
  });

  if (!auditLogStream) {
    throw new ServiceError(
      notFoundError('organization.audit_log_stream', ctx.params.auditLogStreamId)
    );
  }

  return { auditLogStream };
});

export let auditLogStreamManagementController = Controller.create(
  {
    name: 'Audit log stream',
    description: 'Manage organization audit log streams'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('audit-log-streams', 'audit_log_streams.list'), {
        name: 'List organization audit log streams',
        description: 'List all audit log streams configured for the organization'
      })
      .use(checkAccess({ possibleScopes: ['organization.audit_log_stream:read'] }))
      .outputList(auditLogStreamPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await auditLogStreamService.listAuditLogStreams({
          organization: ctx.organization
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, auditLogStream =>
          auditLogStreamPresenter.present({
            auditLogStream: {
              ...auditLogStream,
              organization: ctx.organization
            }
          })
        );
      }),

    get: auditLogStreamManagementGroup
      .get(
        organizationManagementPath(
          'audit-log-streams/:auditLogStreamId',
          'audit_log_streams.get'
        ),
        {
          name: 'Get organization audit log stream',
          description: 'Get a specific audit log stream configured for the organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.audit_log_stream:read'] }))
      .output(auditLogStreamPresenter)
      .do(async ctx =>
        auditLogStreamPresenter.present({ auditLogStream: ctx.auditLogStream })
      ),

    create: organizationGroup
      .post(organizationManagementPath('audit-log-streams', 'audit_log_streams.create'), {
        name: 'Create organization audit log stream',
        description: 'Create an audit log stream for the organization'
      })
      .use(checkAccess({ possibleScopes: ['organization.audit_log_stream:write'] }))
      .body(
        'default',
        v.object({
          provider: v.enumOf(['datadog', 'splunk']),
          provider_data: v.record(v.any())
        })
      )
      .output(auditLogStreamPresenter)
      .do(async ctx => {
        let auditLogStream = await auditLogStreamService.createAuditLogStream({
          organization: ctx.organization,
          input: {
            provider: ctx.body.provider,
            providerData: ctx.body.provider_data
          }
        });

        return auditLogStreamPresenter.present({
          auditLogStream: {
            ...auditLogStream,
            organization: ctx.organization
          }
        });
      }),

    update: auditLogStreamManagementGroup
      .patch(
        organizationManagementPath(
          'audit-log-streams/:auditLogStreamId',
          'audit_log_streams.update'
        ),
        {
          name: 'Update organization audit log stream',
          description: 'Update an audit log stream configured for the organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.audit_log_stream:write'] }))
      .body(
        'default',
        v.object({
          provider: v.optional(v.enumOf(['datadog', 'splunk'])),
          provider_data: v.optional(v.record(v.any())),
          status: v.optional(v.enumOf(['active', 'inactive']))
        })
      )
      .output(auditLogStreamPresenter)
      .do(async ctx => {
        let auditLogStream = await auditLogStreamService.updateAuditLogStream({
          auditLogStream: ctx.auditLogStream,
          input: {
            provider: ctx.body.provider,
            providerData: ctx.body.provider_data,
            status: ctx.body.status
          }
        });

        return auditLogStreamPresenter.present({
          auditLogStream: {
            ...auditLogStream,
            organization: ctx.organization
          }
        });
      }),

    delete: auditLogStreamManagementGroup
      .delete(
        organizationManagementPath(
          'audit-log-streams/:auditLogStreamId',
          'audit_log_streams.delete'
        ),
        {
          name: 'Delete organization audit log stream',
          description: 'Delete an audit log stream configured for the organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.audit_log_stream:write'] }))
      .output(auditLogStreamPresenter)
      .do(async ctx => {
        let auditLogStream = await auditLogStreamService.deleteAuditLogStream({
          auditLogStream: ctx.auditLogStream
        });

        return auditLogStreamPresenter.present({
          auditLogStream: {
            ...auditLogStream,
            organization: ctx.organization
          }
        });
      })
  }
);
