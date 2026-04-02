import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  usePortal
} from '@metorial/state';
import { Attributes, Button, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { PortalConsumerProfilesTable } from '../../scenes/portals/usersTable';

export let PortalOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { portalId } = useParams();
  let portal = usePortal(instance.data?.id, portalId);

  return renderWithLoader({ instance, organization, project, portal })(({ portal }) => (
    <>
      <Spacer size={15} />

      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: portal.data.name
          },
          {
            label: 'Portal ID',
            content: <ID id={portal.data.id} />
          },
          {
            label: 'Slug',
            content: portal.data.slug
          },
          {
            label: 'Portal URL',
            content: <ID id={portal.data.urls[0]?.url} />
          },
          {
            label: 'Session Expiry',
            content: `${portal.data.auth.sessionExpiryTimeInSeconds} seconds`
          },
          {
            label: 'Brand Name',
            content: portal.data.brand.name
          },
          {
            label: 'Created At',
            content: <RenderDate date={portal.data.createdAt} />
          }
        ]}
      />

      <Spacer size={15} />

      <Box
        title="Users"
        description="Manage the users who have access to this portal."
        rightActions={
          <Link
            to={Paths.instance.portal(
              organization.data,
              project.data,
              instance.data,
              portal.data.id,
              'users'
            )}
          >
            <Button size="1">View All Users</Button>
          </Link>
        }
      >
        <PortalConsumerProfilesTable portalId={portal.data.id} limit={25} />
      </Box>
    </>
  ));
};
