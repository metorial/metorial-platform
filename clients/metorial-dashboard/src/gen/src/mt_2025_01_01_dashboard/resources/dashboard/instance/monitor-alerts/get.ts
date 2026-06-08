import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceMonitorAlertsGetOutput = {
  object: 'monitor.alert';
  id: string;
  status: 'pending' | 'resolved' | 'ignored';
  monitor: {
    object: 'monitor';
    id: string;
    name: string;
    description: string | null;
    target: 'protoguard_filter' | 'schema_change';
    status: 'active' | 'inactive';
    owner: 'organization' | 'system';
    protoGuardFilterId: string | null;
    providerId: string | null;
    createdAt: Date;
    updatedAt: Date;
    firstAlertAt: Date | null;
    lastAlertAt: Date | null;
  };
  protoGuardAlertId: string | null;
  protoGuardRunId: string | null;
  specificationChangeNotification: {
    object: 'provider.specification_change_notification';
    id: string;
    providerId: string;
    providerVersionId: string;
    fromSpecification: {
      object: 'provider.capabilities.specification#preview';
      id: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    toSpecification: {
      object: 'provider.capabilities.specification#preview';
      id: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    fromProviderVersion: {
      object: 'provider.version#preview';
      id: string;
      version: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    toProviderVersion: {
      object: 'provider.version#preview';
      id: string;
      version: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: Date;
  } | null;
  createdAt: Date;
  resolvedAt: Date | null;
  recipients: {
    object: 'monitor.alert_recipient';
    id: string;
    recipientId: string;
    viewedAt: Date | null;
    createdAt: Date;
  }[];
  events: {
    object: 'monitor.alert_event';
    id: string;
    type: 'created' | 'viewed' | 'resolved' | 'unresolved';
    actorId: string | null;
    createdAt: Date;
  }[];
};

export let mapDashboardInstanceMonitorAlertsGetOutput =
  mtMap.object<DashboardInstanceMonitorAlertsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    monitor: mtMap.objectField(
      'monitor',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        target: mtMap.objectField('target', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        owner: mtMap.objectField('owner', mtMap.passthrough()),
        protoGuardFilterId: mtMap.objectField(
          'proto_guard_filter_id',
          mtMap.passthrough()
        ),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date()),
        firstAlertAt: mtMap.objectField('first_alert_at', mtMap.date()),
        lastAlertAt: mtMap.objectField('last_alert_at', mtMap.date())
      })
    ),
    protoGuardAlertId: mtMap.objectField(
      'proto_guard_alert_id',
      mtMap.passthrough()
    ),
    protoGuardRunId: mtMap.objectField(
      'proto_guard_run_id',
      mtMap.passthrough()
    ),
    specificationChangeNotification: mtMap.objectField(
      'specification_change_notification',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        providerVersionId: mtMap.objectField(
          'provider_version_id',
          mtMap.passthrough()
        ),
        fromSpecification: mtMap.objectField(
          'from_specification',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        toSpecification: mtMap.objectField(
          'to_specification',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        fromProviderVersion: mtMap.objectField(
          'from_provider_version',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            version: mtMap.objectField('version', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        toProviderVersion: mtMap.objectField(
          'to_provider_version',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            version: mtMap.objectField('version', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    resolvedAt: mtMap.objectField('resolved_at', mtMap.date()),
    recipients: mtMap.objectField(
      'recipients',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          recipientId: mtMap.objectField('recipient_id', mtMap.passthrough()),
          viewedAt: mtMap.objectField('viewed_at', mtMap.date()),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    events: mtMap.objectField(
      'events',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          actorId: mtMap.objectField('actor_id', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    )
  });

