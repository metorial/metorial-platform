import { DashboardInstanceProtoGuardAlertsListOutput } from '@metorial/dashboard-sdk';
import { col, createDataList, f, withDefaults } from '@metorial/data-list';
import { useProtoGuardAlerts } from '@metorial/state';
import { Text } from '@metorial/ui';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import { ProtoGuardSeverityBadge } from './badges';

type ProtoGuardAlert = DashboardInstanceProtoGuardAlertsListOutput['items'][number];

type ProtoGuardAlertsTableProps = {
  filterId?: string;
  issueId?: string;
};

let severityRank = ['critical', 'high', 'medium'];

let getTopSeverity = (alert: ProtoGuardAlert) => {
  for (let severity of severityRank) {
    if (alert.filters.some(filter => filter.severity === severity)) return severity;
  }

  return alert.filters[0]?.severity ?? 'low';
};

let ProtoGuardAlertsList = createDataList<ProtoGuardAlertsTableProps>('protoguard-alerts')
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    sessionId: f.entity(entityFilters.session(ctx.instanceId)),
    createdAt: f.createdAt({ description: 'Filter by created date' })
  }))
  .paginated(({ props, ctx, filters }) =>
    useProtoGuardAlerts(
      ctx.instanceId,
      withDefaults(undefined, {
        order: 'desc' as const,
        filterId: props.filterId,
        issueId: props.issueId,
        ...filters
      })
    )
  )
  .columns([
    col.createdAt(),
    col.text({
      id: 'filters',
      header: 'Top filter',
      weight: 'strong',
      fallback: 'No filter details',
      get: alert =>
        (
          alert.filters.find(filter => filter.severity === 'critical') ??
          alert.filters.find(filter => filter.severity === 'high') ??
          alert.filters[0]
        )?.name
    }),
    col.custom({
      id: 'topSeverity',
      header: 'Top Severity',
      render: alert => <ProtoGuardSeverityBadge severity={getTopSeverity(alert)} />
    }),
    col.custom({
      id: 'confidence',
      header: 'Confidence',
      render: alert => {
        let confidence = Math.max(...alert.filters.map(filter => filter.confidence ?? 0), 0);
        return <Text size="2">{confidence || 'n/a'}</Text>;
      }
    }),
    col.refId('sessionId', alert => alert.sessionId, { header: 'Session ID' }),
    col.refId('messageId', alert => alert.sessionMessageId, { header: 'Message ID' }),
    col.refId('providerRunId', alert => alert.providerRunId, { header: 'Provider Run ID' }),
    col.id({ header: 'ProtoGuard Alert ID' }),
    col.refId('runId', alert => alert.runId, { header: 'Run ID' })
  ])
  .build();

export let ProtoGuardAlertsTable = (props?: ProtoGuardAlertsTableProps) => (
  <ProtoGuardAlertsList {...props} emptyState="No ProtoGuard alerts found." />
);
