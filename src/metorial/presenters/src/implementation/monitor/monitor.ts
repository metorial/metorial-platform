import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { monitorType } from '../../types';

export let v1MonitorPresenter = Presenter.create(monitorType)
  .presenter(async ({ monitor }) => ({
    object: 'monitor' as const,
    id: monitor.id,
    name: monitor.name,
    description: monitor.description,
    target: monitor.target,
    status: monitor.status,
    owner: monitor.owner === 'tenant' ? 'organization' : monitor.owner,
    proto_guard_filter_id: monitor.protoGuardFilter?.id ?? null,
    provider_id: monitor.provider?.id ?? null,
    created_at: monitor.createdAt,
    updated_at: monitor.updatedAt,
    first_alert_at: monitor.firstAlertAt,
    last_alert_at: monitor.lastAlertAt
  }))
  .schema(
    v.object({
      object: v.literal('monitor', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      target: v.enumOf(['protoguard_filter', 'schema_change'] as const, {
        description: 'What the monitor watches.'
      }),
      status: v.enumOf(['active', 'inactive'] as const, {
        description: 'Current status of the monitor. `inactive` monitors raise no alerts.'
      }),
      owner: v.enumOf(['organization', 'system'] as const, {
        description: 'Who manages the monitor. `system` monitors are managed by Metorial.'
      }),
      proto_guard_filter_id: v.nullable(
        v.string({
          description:
            'ProtoGuard filter the monitor watches. `null` unless the target is `protoguard_filter`.'
        })
      ),
      provider_id: v.nullable(
        v.string({
          description: 'Provider the monitor watches. `null` unless scoped to a provider.'
        })
      ),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      }),
      first_alert_at: v.nullable(
        v.date({
          description: 'When the monitor first raised an alert. `null` when it never has.'
        })
      ),
      last_alert_at: v.nullable(
        v.date({
          description: 'When the monitor last raised an alert. `null` when it never has.'
        })
      )
    })
  )
  .build();
