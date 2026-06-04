import type {
  Monitor,
  MonitorAlert,
  MonitorAlertEvent,
  MonitorAlertEventType,
  MonitorAlertRecipient,
  MonitorAlertStatus,
  MonitorOwner,
  MonitorStatus,
  MonitorTarget,
  ProtoGuardFilter,
  Provider,
  TenantActor
} from '@metorial-subspace/db';
import {
  providerSpecificationChangeNotificationPresenter,
  type ProviderSpecificationChangeNotificationPresenterProps
} from './providerSpecificationChangeNotification';

export type MonitorPresenterProps = Monitor & {
  protoGuardFilter: ProtoGuardFilter | null;
  provider: Provider | null;
};

export let monitorPresenter = (monitor: MonitorPresenterProps) => ({
  object: 'monitor',
  id: monitor.id,
  name: monitor.name,
  description: monitor.description,
  target: monitor.target as MonitorTarget,
  status: monitor.status as MonitorStatus,
  owner: monitor.owner as MonitorOwner,
  protoGuardFilterId: monitor.protoGuardFilter?.id ?? null,
  providerId: monitor.provider?.id ?? null,
  tenantId: monitor.tenantOid ? undefined : null,
  createdAt: monitor.createdAt,
  updatedAt: monitor.updatedAt,
  firstAlertAt: monitor.firstAlertAt,
  lastAlertAt: monitor.lastAlertAt
});

export let monitorAlertEventPresenter = (event: MonitorAlertEvent) => ({
  object: 'monitor.alert_event',
  id: event.id,
  type: event.type as MonitorAlertEventType,
  actorId: event.actorOid ? String(event.actorOid) : null,
  createdAt: event.createdAt
});

export type MonitorAlertPresenterProps = MonitorAlert & {
  monitor: MonitorPresenterProps;
  monitorAlertEvents: MonitorAlertEvent[];
  monitorAlertRecipients: (MonitorAlertRecipient & { recipient: TenantActor })[];
  protoGuardAlert: { id: string; run: { id: string } } | null;
  specificationChangeNotification: ProviderSpecificationChangeNotificationPresenterProps | null;
};

export let monitorAlertPresenter = (alert: MonitorAlertPresenterProps) => ({
  object: 'monitor.alert',
  id: alert.id,
  status: alert.status as MonitorAlertStatus,
  monitor: monitorPresenter(alert.monitor),
  protoGuardAlertId: alert.protoGuardAlert?.id ?? null,
  protoGuardRunId: alert.protoGuardAlert?.run.id ?? null,
  specificationChangeNotification: alert.specificationChangeNotification
    ? providerSpecificationChangeNotificationPresenter(alert.specificationChangeNotification)
    : null,
  createdAt: alert.createdAt,
  resolvedAt: alert.resolvedAt,
  recipients: alert.monitorAlertRecipients.map(recipient => ({
    object: 'monitor.alert_recipient',
    id: recipient.id,
    recipientId: recipient.recipient.id,
    viewedAt: recipient.viewedAt,
    createdAt: recipient.createdAt
  })),
  events: alert.monitorAlertEvents.map(monitorAlertEventPresenter)
});

export let protoGuardFilterConfigPresenter = (d: {
  alertFilterCountThreshold: number;
  filters: {
    filter: ProtoGuardFilter;
    enabled: boolean;
    alertConfidenceThreshold: number;
  }[];
}) => ({
  object: 'protoguard.filter_config',
  alertFilterCountThreshold: d.alertFilterCountThreshold,
  filters: d.filters.map(item => ({
    object: 'protoguard.filter',
    id: item.filter.id,
    key: item.filter.key,
    name: item.filter.name,
    description: item.filter.description,
    issueType: item.filter.issueType,
    severity: item.filter.severity,
    scoreWeight: item.filter.scoreWeight,
    defaultEnabled: item.filter.defaultEnabled,
    enabled: item.enabled,
    defaultAlertConfidenceThreshold: item.filter.alertConfidenceThreshold,
    alertConfidenceThreshold: item.alertConfidenceThreshold
  }))
});
