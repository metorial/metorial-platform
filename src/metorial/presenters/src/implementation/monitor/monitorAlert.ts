import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { monitorAlertType } from '../../types';
import { v1MonitorPresenter } from './monitor';
import { v1ProviderSpecificationChangeNotificationPresenter } from './providerSpecificationChangeNotification';

let monitorAlertEventSchema = v.object(
  {
    object: v.literal('monitor.alert_event', {
      description: 'String representing the object’s type.'
    }),
    id: v.string({
      description: 'Unique ID.'
    }),
    type: v.enumOf(['created', 'viewed', 'resolved', 'unresolved'] as const, {
      description: 'What happened.'
    }),
    actor_id: v.nullable(
      v.string({
        description: 'Actor behind the event. `null` when no actor performed it.'
      })
    ),
    created_at: v.date({
      description: 'Creation time.'
    })
  },
  {
    description: 'One entry in the history of the alert.'
  }
);

let monitorAlertRecipientSchema = v.object(
  {
    object: v.literal('monitor.alert_recipient', {
      description: 'String representing the object’s type.'
    }),
    id: v.string({
      description: 'Unique ID.'
    }),
    recipient_id: v.string({
      description: 'Notified actor.'
    }),
    viewed_at: v.nullable(
      v.date({
        description: 'When the recipient viewed the alert. `null` until viewed.'
      })
    ),
    created_at: v.date({
      description: 'Creation time.'
    })
  },
  {
    description: 'One actor notified about the alert.'
  }
);

export let v1MonitorAlertPresenter = Presenter.create(monitorAlertType)
  .presenter(async ({ alert }, opts) => ({
    object: 'monitor.alert' as const,
    id: alert.id,
    status: alert.status,
    monitor: await v1MonitorPresenter.present({ monitor: alert.monitor }, opts).run(),
    proto_guard_alert_id: alert.protoGuardAlert?.id ?? null,
    proto_guard_run_id: alert.protoGuardAlert?.run.id ?? null,
    specification_change_notification: alert.specificationChangeNotification
      ? await v1ProviderSpecificationChangeNotificationPresenter
          .present({ notification: alert.specificationChangeNotification }, opts)
          .run()
      : null,
    created_at: alert.createdAt,
    resolved_at: alert.resolvedAt,
    recipients: alert.monitorAlertRecipients.map(recipient => ({
      object: 'monitor.alert_recipient' as const,
      id: recipient.id,
      recipient_id: recipient.recipient.id,
      viewed_at: recipient.viewedAt,
      created_at: recipient.createdAt
    })),
    events: alert.monitorAlertEvents.map(event => ({
      object: 'monitor.alert_event' as const,
      id: event.id,
      type: event.type,
      // The former RPC presenter exposed the internal actor OID as a decimal string.
      actor_id: event.actorOid ? String(event.actorOid) : null,
      created_at: event.createdAt
    }))
  }))
  .schema(
    v.object({
      object: v.literal('monitor.alert', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.'
      }),
      status: v.enumOf(['pending', 'resolved', 'ignored'] as const, {
        description: 'Current status of the alert. `pending` until you resolve or ignore it.'
      }),
      monitor: v1MonitorPresenter.schema,
      proto_guard_alert_id: v.nullable(
        v.string({
          description: 'ProtoGuard alert behind this alert. `null` for schema-change alerts.'
        })
      ),
      proto_guard_run_id: v.nullable(
        v.string({
          description: 'ProtoGuard run behind this alert. `null` for schema-change alerts.'
        })
      ),
      specification_change_notification: v.nullable(
        v1ProviderSpecificationChangeNotificationPresenter.schema
      ),
      created_at: v.date({
        description: 'Creation time.'
      }),
      resolved_at: v.nullable(
        v.date({
          description: 'When the alert was resolved. `null` while pending.'
        })
      ),
      recipients: v.array(monitorAlertRecipientSchema, {
        description: 'Actors notified about the alert.'
      }),
      events: v.array(monitorAlertEventSchema, {
        description: 'History of the alert.'
      })
    })
  )
  .build();
