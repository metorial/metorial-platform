import {
  DashboardInstanceSessionTemplatesListOutput,
  DashboardInstanceSessionTemplatesListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteSessionTemplate,
  useSessionTemplates
} from '@metorial/state';
import { RenderDate, Text, confirm } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine } from '@remixicon/react';
import { useMemo, useState } from 'react';
import { Table as DashboardTable } from '@metorial/table';
import {
  FilterPayload,
  TableFilter,
  TableStateProvider,
  TableStateProviderResult,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getListFilterValue
} from '@metorial/table';
import { entityFilters } from '../entityFilters';

type SessionTemplate = DashboardInstanceSessionTemplatesListOutput['items'][number];

type SessionTemplatesTableProps = {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getSessionTemplateStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceSessionTemplatesListQuery['status'] =>
  getEnumListFilterValue(value, ['active', 'archived']);

export let useSessionTemplateFilters = (instanceId: string | null | undefined) =>
  useMemo<TableFilter<SessionTemplate>[]>(
    () => [
      {
        id: 'status',
        fields: ['status'],
        label: 'Status',
        description: 'Filter by status',
        type: 'select',
        options: [
          { id: 'active', label: 'Active' },
          { id: 'archived', label: 'Archived' }
        ]
      },
      entityFilters.session(instanceId),
      entityFilters.provider(instanceId),
      entityFilters.providerDeployment(instanceId),
      entityFilters.providerConfig(instanceId),
      entityFilters.providerAuthConfig(instanceId),
      {
        id: 'createdAt',
        fields: ['createdAt'],
        label: 'Created',
        description: 'Filter by created date',
        type: 'date'
      },
      {
        id: 'updatedAt',
        fields: ['updatedAt'],
        label: 'Updated',
        description: 'Filter by updated date',
        type: 'date'
      }
    ],
    [instanceId]
  );

let sessionTemplatesState: TableStateProvider<
  SessionTemplatesTableProps,
  SessionTemplate,
  TableStateProviderResult<SessionTemplate>
> = (props, opts) => {
  let templates = useSessionTemplates(props.instanceId, {
    order: 'desc',
    status: getSessionTemplateStatusFilterValue(opts.filter.status),
    sessionId: getListFilterValue(opts.filter.sessionId),
    providerId: getListFilterValue(opts.filter.providerId),
    providerDeploymentId: getListFilterValue(opts.filter.providerDeploymentId),
    providerConfigId: getListFilterValue(opts.filter.providerConfigId),
    providerAuthConfigId: getListFilterValue(opts.filter.providerAuthConfigId),
    createdAt: getDateRangeFilterValue(opts.filter.createdAt),
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt)
  });

  return {
    isLoading: templates.isLoading,
    error: templates.error,
    hasMoreAfter: templates.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: templates.data?.pagination.hasMoreBefore ?? false,
    items: templates.data?.items ?? [],
    loadNext: templates.next,
    loadPrevious: templates.previous
  };
};

let useSessionTemplatesTableHookState = (
  _: ReturnType<typeof sessionTemplatesState>,
  props: SessionTemplatesTableProps
) => {
  let deleteTemplate = useDeleteSessionTemplate();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteTemplate,
    instanceId: props.instanceId,
    loadingIds,
    setLoadingIds
  };
};

let deleteSessionTemplateImmediately = async (
  template: SessionTemplate,
  state: ReturnType<typeof useSessionTemplatesTableHookState>
) => {
  state.setLoadingIds((current: string[]) => [...new Set([...current, template.id])]);

  try {
    await state.deleteTemplate.mutate({
      instanceId: state.instanceId,
      sessionTemplateId: template.id
    });
  } finally {
    state.setLoadingIds((current: string[]) => current.filter(id => id != template.id));
  }
};

let sessionTemplatesTable = new DashboardTable<SessionTemplatesTableProps, SessionTemplate>(
  'session-templates'
)
  .state(sessionTemplatesState)
  .hookState(useSessionTemplatesTableHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: template => (
        <div>
          <Text size="2" weight="strong">
            {template.name ?? 'Unnamed'}
          </Text>
          {template.description && (
            <Text size="1" color="gray600">
              {template.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'providers',
      isDefault: true,
      header: 'Providers',
      render: template => <Text size="2">{template.providers.length} providers</Text>
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: template => <RenderDate date={template.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: template => <RenderDate date={template.updatedAt} />
    },
    {
      id: 'providerStatuses',
      isDefault: false,
      header: 'Provider Statuses',
      render: template => (
        <Text size="2">
          {[...new Set(template.providers.map(provider => provider.status))].join(', ') || '—'}
        </Text>
      )
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Template ID',
      render: template => <ID id={template.id} />
    }
  ])
  .link((template, props) =>
    Paths.instance.sessionTemplate(
      props.organization.data,
      props.project.data,
      props.instance.data,
      template.id
    )
  )
  .actions({
    deleteImmediate: async (templates, state) => {
      let template = templates[0];
      if (!template) return;

      await deleteSessionTemplateImmediately(template, state);
    },
    delete: async (templates, state) => {
      let template = templates[0];
      if (!template) return;

      confirm({
        title: 'Delete session template',
        description: `Are you sure you want to delete ${template.name ?? 'this session template'}?`,
        confirmText: 'Delete',
        onConfirm: async () => {
          await deleteSessionTemplateImmediately(template, state);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      action: 'delete'
    }
  ])
  .bulkActions([
    {
      id: 'delete-selected',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      action: 'deleteImmediate',
      bulkExecution: {
        mode: 'per-row',
        batchSize: 10
      }
    }
  ])
  .build();

export let SessionTemplatesTable = ({ instanceId }: { instanceId: string }) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let tableFilters = useSessionTemplateFilters(instanceId);

  return sessionTemplatesTable({
    instanceId,
    organization,
    project,
    instance,
    tableFilters,
    emptyState: 'No templates found.'
  });
};
