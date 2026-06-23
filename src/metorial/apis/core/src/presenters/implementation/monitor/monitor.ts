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
    proto_guard_filter_id: monitor.protoGuardFilterId,
    provider_id: monitor.providerId,
    created_at: monitor.createdAt,
    updated_at: monitor.updatedAt,
    first_alert_at: monitor.firstAlertAt,
    last_alert_at: monitor.lastAlertAt
  }))
  .schema(
    v.object({
      object: v.literal('monitor'),
      id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      target: v.enumOf(['protoguard_filter', 'schema_change'] as const),
      status: v.enumOf(['active', 'inactive'] as const),
      owner: v.enumOf(['organization', 'system'] as const),
      proto_guard_filter_id: v.nullable(v.string()),
      provider_id: v.nullable(v.string()),
      created_at: v.date(),
      updated_at: v.date(),
      first_alert_at: v.nullable(v.date()),
      last_alert_at: v.nullable(v.date())
    })
  )
  .build();
