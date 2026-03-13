import {
  DashboardInstanceIdentityActorsListOutput,
  DashboardInstanceIdentityActorsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentityActors
} from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';

type IdentityActorFilters = Omit<
  DashboardInstanceIdentityActorsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let getActorTypeLabel = (
  type: DashboardInstanceIdentityActorsListOutput['items'][number]['type']
) => {
  if (type === 'agent') return 'Agent';
  return 'Person';
};

let getActorStatusColor = (
  status: DashboardInstanceIdentityActorsListOutput['items'][number]['status']
) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

export let IdentityActorsTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: IdentityActorFilters;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let actors = useIdentityActors(instanceId, {
    order: 'desc',
    ...filters
  });

  return renderWithPagination(actors)(actors => (
    <>
      <Table
        headers={['Name', 'Type', 'Created']}
        data={actors.data.items.map(actor => ({
          href: Paths.instance.identity.actor(
            organization.data,
            project.data,
            instance.data,
            actor.id
          ),
          data: [
            <div>
              <Text size="2" weight="strong">
                {actor.name}
              </Text>
              {actor.description && (
                <Text size="1" color="gray600">
                  {actor.description}
                </Text>
              )}
            </div>,
            <Text size="2">{getActorTypeLabel(actor.type)}</Text>,
            // <Badge color={getActorStatusColor(actor.status)}>{actor.status}</Badge>,
            actor.agentId ? (
              <ID id={actor.agentId} />
            ) : (
              <Text size="2" color="gray600">
                —
              </Text>
            ),
            <RenderDate date={actor.createdAt} />
          ]
        }))}
      />

      {actors.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No identity actors found.
        </Text>
      )}
    </>
  ));
};
