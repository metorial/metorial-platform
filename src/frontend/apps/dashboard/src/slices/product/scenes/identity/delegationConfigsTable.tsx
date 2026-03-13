import {
  DashboardInstanceIdentitiesDelegationConfigsListOutput,
  DashboardInstanceIdentitiesDelegationConfigsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentityDelegationConfigs
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

type IdentityDelegationConfigFilters = Omit<
  DashboardInstanceIdentitiesDelegationConfigsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let getDelegationConfigStatusColor = (
  status: DashboardInstanceIdentitiesDelegationConfigsListOutput['items'][number]['status']
) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let getDelegationBehaviorLabel = (
  behavior: DashboardInstanceIdentitiesDelegationConfigsListOutput['items'][number]['subDelegationBehavior']
) => {
  if (behavior === 'require_consent') return 'Require Consent';
  if (behavior === 'allow') return 'Allow';
  return 'Deny';
};

export let IdentityDelegationConfigsTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: IdentityDelegationConfigFilters;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let delegationConfigs = useIdentityDelegationConfigs(instanceId, {
    order: 'desc',
    ...filters
  });

  return renderWithPagination(delegationConfigs)(delegationConfigs => (
    <>
      <Table
        headers={['Name', 'Behavior', 'Default', 'Created']}
        data={delegationConfigs.data.items.map(config => ({
          href: Paths.instance.identity.delegationConfig(
            organization.data,
            project.data,
            instance.data,
            config.id
          ),
          data: [
            <div>
              <Text size="2" weight="strong">
                {config.name ?? 'Unnamed'}
              </Text>
              {config.description && (
                <Text size="1" color="gray600">
                  {config.description}
                </Text>
              )}
            </div>,
            <Text size="2">{getDelegationBehaviorLabel(config.subDelegationBehavior)}</Text>,
            config.isDefault ? <Badge color="blue">Default</Badge> : <Text size="2">No</Text>,
            <RenderDate date={config.createdAt} />
          ]
        }))}
      />

      {delegationConfigs.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No delegation configs found.
        </Text>
      )}
    </>
  ));
};
