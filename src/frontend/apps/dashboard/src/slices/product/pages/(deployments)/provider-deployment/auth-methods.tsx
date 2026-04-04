import { DashboardInstanceProvidersAuthMethodsListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProvider,
  useProviderAuthMethods,
  useProviderDeployment
} from '@metorial/state';
import { Badge, Button, Flex, Text } from '@metorial/ui';
import { Table as DashboardTable } from '../../../../../components/table';
import { FilterPayload } from '../../../../../components/table/filter';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../../components/table/type';
import { useParams } from 'react-router-dom';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';
import {
  getProviderAuthMethodSchemaFieldCount,
  getProviderAuthMethodTypeColor,
  getProviderAuthMethodTypeLabel,
  hasProviderAuthMethodSchemaFields,
  showProviderAuthMethodDetailsModal
} from '../../../scenes/providers/authMethodDetails';

type ProviderDeploymentAuthMethod =
  DashboardInstanceProvidersAuthMethodsListOutput['items'][number];

type ProviderDeploymentAuthMethodsTableProps = {
  instanceId: string;
  effectiveVersionId: string;
};

let providerDeploymentAuthMethodsTableState: TableStateProvider<
  ProviderDeploymentAuthMethodsTableProps,
  ProviderDeploymentAuthMethod,
  TableStateProviderResult<ProviderDeploymentAuthMethod>
> = (
  props: ProviderDeploymentAuthMethodsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let authMethods = useProviderAuthMethods(props.instanceId, {
    providerVersionId: props.effectiveVersionId
  });
  let normalizedSearch = opts.search?.trim().toLowerCase() ?? '';
  let items = (authMethods.data?.items ?? []).filter(method => {
    if (!normalizedSearch) return true;

    return [method.name, method.description ?? '', getProviderAuthMethodTypeLabel(method.type)]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch);
  });

  return {
    isLoading: authMethods.isLoading,
    error: authMethods.error,
    hasMoreAfter: authMethods.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: authMethods.data?.pagination.hasMoreBefore ?? false,
    items,
    loadNext: authMethods.next,
    loadPrevious: authMethods.previous
  };
};

let providerDeploymentAuthMethodsTable = new DashboardTable<
  ProviderDeploymentAuthMethodsTableProps,
  ProviderDeploymentAuthMethod
>('provider-deployment-auth-methods')
  .state(providerDeploymentAuthMethodsTableState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: method => {
        let description =
          method.description && method.description.length > 110
            ? `${method.description.slice(0, 110)}...`
            : (method.description ?? '');

        return (
          <Flex direction="column" gap={2}>
            <Text size="2" weight="strong">
              {method.name}
            </Text>
            <Text
              size="2"
              color="gray600"
              style={{
                display: 'block',
                maxWidth: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {description}
            </Text>
          </Flex>
        );
      }
    },
    {
      id: 'type',
      isDefault: true,
      header: 'Type',
      render: method => (
        <Flex gap={6} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge color={getProviderAuthMethodTypeColor(method.type)} size="1">
            {getProviderAuthMethodTypeLabel(method.type)}
          </Badge>
        </Flex>
      )
    },
    {
      id: 'details',
      isDefault: true,
      header: 'Details',
      render: method => {
        let hasInputFields = hasProviderAuthMethodSchemaFields(method.inputSchema);
        let hasOutputFields = hasProviderAuthMethodSchemaFields(method.outputSchema);
        let scopeCount = method.type === 'oauth' ? (method.scopes?.length ?? 0) : 0;

        return (
          <Flex gap={6} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            {scopeCount > 0 ? (
              <Badge color="gray" size="1">
                {scopeCount} Scopes
              </Badge>
            ) : null}
            {hasInputFields ? (
              <Badge color="cyan" size="1">
                {getProviderAuthMethodSchemaFieldCount(method.inputSchema)} Input Fields
              </Badge>
            ) : null}
            {hasOutputFields ? (
              <Badge color="purple" size="1">
                {getProviderAuthMethodSchemaFieldCount(method.outputSchema)} Output Fields
              </Badge>
            ) : null}
            {scopeCount === 0 && !hasInputFields && !hasOutputFields ? (
              <Text size="2" color="gray600">
                -
              </Text>
            ) : null}
          </Flex>
        );
      }
    },
    {
      id: 'action',
      isDefault: true,
      header: 'Action',
      render: method => (
        <Flex style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button
            size="1"
            variant="outline"
            onClick={() => showProviderAuthMethodDetailsModal(method)}
          >
            View Details
          </Button>
        </Flex>
      )
    }
  ])
  .search('Search auth methods...')
  .build();

export let ProviderDeploymentAuthMethodsPage = () => {
  let instance = useCurrentInstance();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let provider = useProvider(instance.data?.id, deployment.data?.providerId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;

  return renderWithLoader({ instance, deployment, provider })(() => (
    <ProviderDeploymentTabSection>
      {!effectiveVersionId ? (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          {provider.data?.type?.auth?.status === 'enabled'
            ? 'No provider version is available yet, so auth methods cannot be loaded.'
            : 'This deployment does not require authentication.'}
        </Text>
      ) : (
        providerDeploymentAuthMethodsTable({
          instanceId: instance.data!.id,
          effectiveVersionId,
          emptyState: 'No auth methods for this deployment.'
        })
      )}
    </ProviderDeploymentTabSection>
  ));
};
