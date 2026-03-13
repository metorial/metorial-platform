import {
  DashboardInstanceIdentitiesDelegationsListOutput,
  DashboardInstanceIdentitiesDelegationsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentityDelegations
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

type IdentityDelegationFilters = Omit<
  DashboardInstanceIdentitiesDelegationsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let getDelegationStatusColor = (
  status: DashboardInstanceIdentitiesDelegationsListOutput['items'][number]['status']
) => {
  if (status === 'active') return 'green';
  if (status === 'waiting_for_consent') return 'orange';
  if (status === 'denied') return 'red';
  return 'gray';
};

let getPartyName = (
  parties: DashboardInstanceIdentitiesDelegationsListOutput['items'][number]['parties'],
  role: 'owner' | 'delegatee' | 'delegator'
) => {
  return parties.find(party => party.roles.includes(role))?.actor.name ?? '—';
};

export let IdentityDelegationsTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: IdentityDelegationFilters;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let delegations = useIdentityDelegations(instanceId, {
    order: 'desc',
    ...filters
  });

  return renderWithPagination(delegations)(delegations => (
    <>
      <Table
        headers={['Delegatee', 'Owner', 'Status', 'Permissions', 'Created']}
        data={delegations.data.items.map(delegation => ({
          href: Paths.instance.identity.delegation(
            organization.data,
            project.data,
            instance.data,
            delegation.id
          ),
          data: [
            <div>
              <Text size="2" weight="strong">
                {getPartyName(delegation.parties, 'delegatee')}
              </Text>
              <Text size="1" color="gray600">
                via {getPartyName(delegation.parties, 'delegator')}
              </Text>
            </div>,
            <Text size="2">{getPartyName(delegation.parties, 'owner')}</Text>,
            <Badge color={getDelegationStatusColor(delegation.status)}>
              {delegation.status}
            </Badge>,
            <Text size="2">{delegation.permissions.join(', ')}</Text>,
            <RenderDate date={delegation.createdAt} />
          ]
        }))}
      />

      {delegations.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No delegations found.
        </Text>
      )}
    </>
  ));
};
