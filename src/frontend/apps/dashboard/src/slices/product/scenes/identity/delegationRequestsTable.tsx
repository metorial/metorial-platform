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
import { Link } from 'react-router-dom';

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
        headers={['Requester', 'Status', 'Delegation', 'Identity', 'Expires', 'Created']}
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
            <Link
              to={Paths.instance.identity.actor(
                organization.data,
                project.data,
                instance.data,
                request.requester.id
              )}
              onClick={e => e.stopPropagation()}
            >
              {request.requester.name}
            </Link>,
            <Badge color={getRequestStatusColor(request.status)}>{request.status}</Badge>,
            request.delegation?.id ? <ID id={request.delegation.id} /> : '—',
            <Link
              to={Paths.instance.identity.identity(
                organization.data,
                project.data,
                instance.data,
                request.identityId
              )}
              onClick={e => e.stopPropagation()}
            >
              <ID id={request.identityId} />
            </Link>,
            <RenderDate date={request.expiresAt} />,
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
