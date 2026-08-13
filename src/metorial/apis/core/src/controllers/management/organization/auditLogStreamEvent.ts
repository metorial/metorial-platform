import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { db } from '@metorial/db';
import { auditLogStreamEventService } from '@metorial/module-audit-log-stream';
import { auditLogStreamEventPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { organizationManagementPath } from '../../../middleware/organizationGroup';
import { auditLogStreamManagementGroup } from './auditLogStream';

let auditLogStreamEventManagementGroup = auditLogStreamManagementGroup.use(async ctx => {
  if (!ctx.params.auditLogStreamEventId) {
    throw new ServiceError(
      badRequestError({
        message: 'auditLogStreamEventId is required',
        description: 'The auditLogStreamEventId path parameter is required.'
      })
    );
  }

  let auditLogStreamEvent = await db.auditLogStreamEvent.findFirst({
    where: {
      id: ctx.params.auditLogStreamEventId,
      auditLogStreamOid: ctx.auditLogStream.oid
    },
    include: { auditLogStream: true }
  });

  if (!auditLogStreamEvent) {
    throw new ServiceError(
      notFoundError('organization.audit_log_stream.event', ctx.params.auditLogStreamEventId)
    );
  }

  return { auditLogStreamEvent };
});

export let auditLogStreamEventManagementController = Controller.create(
  {
    name: 'Audit log stream event',
    description: 'Read organization audit log stream lifecycle events'
  },
  {
    list: auditLogStreamManagementGroup
      .get(
        organizationManagementPath(
          'audit-log-streams/:auditLogStreamId/events',
          'audit_log_streams.events.list'
        ),
        {
          name: 'List audit log stream events',
          description: 'List lifecycle events recorded for an audit log stream'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.audit_log_stream:read'] }))
      .outputList(auditLogStreamEventPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await auditLogStreamEventService.listAuditLogStreamEvents({
          auditLogStream: ctx.auditLogStream
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, auditLogStreamEvent =>
          auditLogStreamEventPresenter.present({
            auditLogStreamEvent: {
              ...auditLogStreamEvent,
              auditLogStream: ctx.auditLogStream
            }
          })
        );
      }),

    get: auditLogStreamEventManagementGroup
      .get(
        organizationManagementPath(
          'audit-log-streams/:auditLogStreamId/events/:auditLogStreamEventId',
          'audit_log_streams.events.get'
        ),
        {
          name: 'Get audit log stream event',
          description: 'Get a lifecycle event recorded for an audit log stream'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.audit_log_stream:read'] }))
      .output(auditLogStreamEventPresenter)
      .do(async ctx =>
        auditLogStreamEventPresenter.present({
          auditLogStreamEvent: ctx.auditLogStreamEvent
        })
      )
  }
);
