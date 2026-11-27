import { DashboardInstanceSessionTemplatesListOutput } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  deleteAction,
  f,
  lifecycleStatus,
  withDefaults
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useDeleteSessionTemplate, useSessionTemplates } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

type SessionTemplate = DashboardInstanceSessionTemplatesListOutput['items'][number];

export let SessionTemplatesTable = createDataList<{ instanceId?: string }>('session-templates')
  .context(useInstanceContext)
  .filters((props, ctx) => {
    let instanceId = props.instanceId ?? ctx.instanceId;

    return {
      status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
      sessionId: f.entity(entityFilters.session(instanceId)),
      providerId: f.entity(entityFilters.provider(instanceId)),
      providerDeploymentId: f.entity(entityFilters.providerDeployment(instanceId)),
      providerConfigId: f.entity(entityFilters.providerConfig(instanceId)),
      providerAuthConfigId: f.entity(entityFilters.providerAuthConfig(instanceId)),
      createdAt: f.createdAt(),
      updatedAt: f.updatedAt()
    };
  })
  .paginated(({ props, ctx, filters }) =>
    useSessionTemplates(
      props.instanceId ?? ctx.instanceId,
      withDefaults({ ownership: 'all' as const, order: 'desc' as const }, filters)
    )
  )
  .columns([
    col.name<SessionTemplate>(),
    col.count<SessionTemplate>('providers', row => row.providers.length, 'provider', {
      header: 'Providers'
    }),
    col.createdAt<SessionTemplate>(),
    col.updatedAt<SessionTemplate>(),
    col.text<SessionTemplate>({
      id: 'providerStatuses',
      header: 'Provider Statuses',
      isDefault: false,
      get: row => [...new Set(row.providers.map(provider => provider.status))].join(', ')
    }),
    col.id<SessionTemplate>()
  ])
  .link((row, _props, ctx) =>
    Paths.instance.sessionTemplate(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .itemActions([
    deleteAction({
      noun: 'Session Template',
      name: row => row.name,
      useMutate: () => useDeleteSessionTemplate(),
      input: (row, { props, ctx }) => ({
        instanceId: (props.instanceId ?? ctx.instanceId)!,
        sessionTemplateId: row.id
      })
    })
  ])
  .build();
