import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { monitorAlertType } from '../../types';
import { v1MonitorPresenter } from './monitor';
import { v1ProviderSpecificationChangeNotificationPresenter } from './providerSpecificationChangeNotification';

let monitorAlertEventSchema = v.object({
  object: v.literal('monitor.alert_event'),
  id: v.string(),
  type: v.enumOf(['created', 'viewed', 'resolved', 'unresolved'] as const),
  actor_id: v.nullable(v.string()),
  created_at: v.date()
});

let monitorAlertRecipientSchema = v.object({
  object: v.literal('monitor.alert_recipient'),
  id: v.string(),
  recipient_id: v.string(),
  viewed_at: v.nullable(v.date()),
  created_at: v.date()
});

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
      object: v.literal('monitor.alert'),
      id: v.string(),
      status: v.enumOf(['pending', 'resolved', 'ignored'] as const),
      monitor: v1MonitorPresenter.schema,
      proto_guard_alert_id: v.nullable(v.string()),
      proto_guard_run_id: v.nullable(v.string()),
      specification_change_notification: v.nullable(
        v1ProviderSpecificationChangeNotificationPresenter.schema
      ),
      created_at: v.date(),
      resolved_at: v.nullable(v.date()),
      recipients: v.array(monitorAlertRecipientSchema),
      events: v.array(monitorAlertEventSchema)
    })
  )
  .build();
