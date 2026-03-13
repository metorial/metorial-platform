import {
  DashboardInstanceIdentitiesListOutput,
  DashboardInstanceIdentitiesListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentities
} from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

type IdentityFilters = Omit<
  DashboardInstanceIdentitiesListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let getIdentityStatusColor = (
  status: DashboardInstanceIdentitiesListOutput['items'][number]['status']
) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

export let IdentitiesTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: IdentityFilters;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let identities = useIdentities(instanceId, {
    order: 'desc',
    ...filters
  });

  return renderWithPagination(identities)(identities => (
    <>
      <Table
        headers={['Name', 'Owner', 'Created']}
        data={identities.data.items.map(identity => ({
          href: Paths.instance.identity.identity(
            organization.data,
            project.data,
            instance.data,
            identity.id
          ),
          data: [
            <div>
              <Text size="2" weight="strong">
                {identity.name ?? 'Unnamed'}
              </Text>
              {identity.description && (
                <Text size="1" color="gray600">
                  {identity.description}
                </Text>
              )}
            </div>,
            <div>
              <Text size="2">{identity.owner.actor.name}</Text>
              <Text size="1" color="gray600">
                {identity.owner.actor.type}
              </Text>
            </div>,
            // <Badge color={getIdentityStatusColor(identity.status)}>{identity.status}</Badge>,
            <RenderDate date={identity.createdAt} />
          ]
        }))}
      />

      {identities.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No identities found.
        </Text>
      )}
    </>
  ));
};
