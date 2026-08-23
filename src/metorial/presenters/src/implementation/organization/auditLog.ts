import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { auditLogType } from '../../types';

export let v1AuditLogPresenter = Presenter.create(auditLogType)
  .presenter(async ({ auditLog }) => ({
    object: 'organization.audit_log',
    id: auditLog.id,
    event_id: auditLog.eventId ?? null,
    resource: auditLog.resource,
    action: auditLog.action,
    organization_id: auditLog.organizationId,
    instance_id: auditLog.instanceId ?? null,
    organization_actor_id: auditLog.organizationActorId ?? null,
    actor: auditLog.actor
      ? {
          type: auditLog.actor.type,
          id: auditLog.actor.id,
          metadata: auditLog.actor.metadata ?? null,
          record: auditLog.actor.record
            ? auditLog.actor.record.object == 'organization_actor'
              ? {
                  object: auditLog.actor.record.object,
                  id: auditLog.actor.record.id,
                  type: auditLog.actor.record.type,
                  name: auditLog.actor.record.name,
                  email: auditLog.actor.record.email,
                  image_url: auditLog.actor.record.imageUrl,
                  member: auditLog.actor.record.member ?? null,
                  consumer_profile: auditLog.actor.record.consumerProfile
                    ? {
                        id: auditLog.actor.record.consumerProfile.id,
                        status: auditLog.actor.record.consumerProfile.status,
                        name: auditLog.actor.record.consumerProfile.name,
                        email: auditLog.actor.record.consumerProfile.email,
                        instance_id: auditLog.actor.record.consumerProfile.instanceId
                      }
                    : null
                }
              : {
                  object: auditLog.actor.record.object,
                  id: auditLog.actor.record.id,
                  status: auditLog.actor.record.status,
                  name: auditLog.actor.record.name,
                  email: auditLog.actor.record.email,
                  instance_id: auditLog.actor.record.instanceId,
                  organization_actor_id: auditLog.actor.record.organizationActorId ?? null
                }
            : null
        }
      : (null as any),

    context: auditLog.context,
    payload: auditLog.payload ?? null,
    previous_attributes: auditLog.previousAttributes ?? null,
    recorded_at: auditLog.recordedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.audit_log'),
      id: v.string(),
      event_id: v.nullable(v.string()),
      resource: v.string(),
      action: v.string(),
      organization_id: v.string(),
      instance_id: v.nullable(v.string()),
      organization_actor_id: v.nullable(v.string()),
      actor: v.nullable(
        v.object({
          type: v.string(),
          id: v.nullable(v.string()),
          metadata: v.nullable(v.record(v.any())),
          record: v.nullable(v.any())
        })
      ),
      context: v.object({
        ip: v.nullable(v.string()),
        ua: v.nullable(v.string())
      }),
      payload: v.nullable(v.record(v.any())),
      previous_attributes: v.nullable(v.record(v.any())),
      recorded_at: v.date()
    })
  )
  .build();
