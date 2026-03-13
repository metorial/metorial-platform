import { DashboardInstanceIdentitiesDelegationRequestsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentityDelegationRequests
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';

type IdentityDelegationRequestFilters = Omit<
  DashboardInstanceIdentitiesDelegationRequestsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let getRequestStatusColor = (status: 'pending' | 'approved' | 'denied' | 'canceled') => {
  if (status === 'approved') return 'green';
  if (status === 'pending') return 'orange';
  if (status === 'denied') return 'red';
  return 'gray';
};

export let IdentityDelegationRequestsTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: IdentityDelegationRequestFilters;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let requests = useIdentityDelegationRequests(instanceId, {
    order: 'desc',
    ...filters
  });

  return renderWithPagination(requests)(requests => (
    <>
      <Table
        headers={['Requester', 'Status', 'Delegation', 'Identity', 'Created']}
        data={requests.data.items.map(request => ({
          href: request.delegation?.id
            ? Paths.instance.identity.delegation(
                organization.data,
                project.data,
                instance.data,
                request.delegation.id
              )
            : undefined,
          data: [
            request.requester.name,
            <Badge color={getRequestStatusColor(request.status)}>{request.status}</Badge>,
            <ID id={request.delegation.id} />,
            request.delegation.identity.name,
            <RenderDate date={request.createdAt} />
          ]
        }))}
      />

      {requests.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No delegation requests found.
        </Text>
      )}
    </>
  ));
};
