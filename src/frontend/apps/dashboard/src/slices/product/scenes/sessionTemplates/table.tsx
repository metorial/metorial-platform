import {
  DashboardInstanceSessionTemplatesListOutput,
  DashboardInstanceSessionTemplatesListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSessionTemplates
} from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '../../../../components/table';
import { FilterPayload } from '../../../../components/table/filter';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../components/table/type';
import {
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue
} from '../../../../lib/dataTableUtils';

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

let sessionTemplatesState: TableStateProvider<
  SessionTemplatesTableProps,
  SessionTemplate,
  TableStateProviderResult<SessionTemplate>
> = (props, opts) => {
  let templates = useSessionTemplates(props.instanceId, {
    order: 'desc',
    status: getSessionTemplateStatusFilterValue(opts.filter.status),
    id: getStringFilterValue(opts.filter.id),
    sessionId: getStringFilterValue(opts.filter.sessionId),
    sessionProviderId: getStringFilterValue(opts.filter.sessionProviderId),
    providerId: getStringFilterValue(opts.filter.providerId),
    providerDeploymentId: getStringFilterValue(opts.filter.providerDeploymentId),
    providerConfigId: getStringFilterValue(opts.filter.providerConfigId),
    providerAuthConfigId: getStringFilterValue(opts.filter.providerAuthConfigId),
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

let sessionTemplatesTable = new DashboardTable<SessionTemplatesTableProps, SessionTemplate>(
  'session-templates'
)
  .state(sessionTemplatesState)
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
  .filters([
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
    {
      id: 'id',
      fields: ['id'],
      label: 'Template ID',
      description: 'Filter by template ID',
      type: 'string'
    },
    {
      id: 'sessionId',
      fields: ['sessionId'],
      label: 'Session ID',
      description: 'Filter by session ID',
      type: 'string'
    },
    {
      id: 'sessionProviderId',
      fields: ['sessionProviderId'],
      label: 'Session Provider ID',
      description: 'Filter by session provider ID',
      type: 'string'
    },
    {
      id: 'providerId',
      fields: ['providerId'],
      label: 'Provider ID',
      description: 'Filter by provider ID',
      type: 'string'
    },
    {
      id: 'providerDeploymentId',
      fields: ['providerDeploymentId'],
      label: 'Deployment ID',
      description: 'Filter by deployment ID',
      type: 'string'
    },
    {
      id: 'providerConfigId',
      fields: ['providerConfigId'],
      label: 'Config ID',
      description: 'Filter by config ID',
      type: 'string'
    },
    {
      id: 'providerAuthConfigId',
      fields: ['providerAuthConfigId'],
      label: 'Auth Config ID',
      description: 'Filter by auth config ID',
      type: 'string'
    },
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
  ])
  .link((template, props) =>
    Paths.instance.sessionTemplate(
      props.organization.data,
      props.project.data,
      props.instance.data,
      template.id
    )
  )
  .build();

export let SessionTemplatesTable = ({ instanceId }: { instanceId: string }) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return sessionTemplatesTable({
    instanceId,
    organization,
    project,
    instance,
    emptyState: 'No templates found.'
  });
};
