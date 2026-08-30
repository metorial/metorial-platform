import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { auditLogType } from '../../types';

type AuditLogActorRecord = NonNullable<
  NonNullable<Parameters<typeof presentActorRecord>[0]>
>;

let presentActorRecord = (
  record:
    | {
        object: 'organization_actor';
        id: string;
        type: string;
        name: string | null;
        email: string | null;
        imageUrl: string | null;
        member?: { id: string; status: string; role: string };
        consumerProfile?: {
          id: string;
          status: string;
          name: string | null;
          email: string | null;
          instanceId: string;
        };
      }
    | {
        object: 'consumer_profile';
        id: string;
        status: string;
        name: string | null;
        email: string | null;
        instanceId: string;
        organizationActorId: string | null;
      }
    | {
        object: 'resource_actor';
        id: string;
        type: string;
        name: string;
        identifier: string;
      }
    | undefined
) => {
  if (!record) return null;

  if (record.object == 'organization_actor') {
    return {
      object: record.object,
      id: record.id,
      type: record.type,
      name: record.name,
      email: record.email,
      image_url: record.imageUrl,
      member: record.member ?? null,
      consumer_profile: record.consumerProfile
        ? {
            id: record.consumerProfile.id,
            status: record.consumerProfile.status,
            name: record.consumerProfile.name,
            email: record.consumerProfile.email,
            instance_id: record.consumerProfile.instanceId
          }
        : null
    };
  }

  if (record.object == 'resource_actor') {
    return {
      object: record.object,
      id: record.id,
      type: record.type,
      name: record.name,
      identifier: record.identifier
    };
  }

  return {
    object: record.object,
    id: record.id,
    status: record.status,
    name: record.name,
    email: record.email,
    instance_id: record.instanceId,
    organization_actor_id: record.organizationActorId ?? null
  };
};

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
          record: presentActorRecord(auditLog.actor.record as AuditLogActorRecord | undefined)
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
