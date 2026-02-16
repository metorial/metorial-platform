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
import { PortalConsumerProfilesTable } from '../../../scenes/portals/usersTable';

export let PortalOverviewPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let params = useParams();
  let portal = usePortal(instance.data?.instanceId, params.portalId!);

  return (
    <>
      {renderWithLoader({ portal })(({ portal }) => (
        <>
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
                label: 'Portal URL',
                content: <ID id={portal.data.urls[0].url} />
              },
              {
                label: 'Created At',
                content: <RenderDate date={portal.data.createdAt!} />
              }
            ]}
          />

          <Spacer height={15} />

          <Box
            title="Users"
            description="Manage the users who have access to this portal."
            rightActions={
              <Link
                to={Paths.instance.portal(
                  organization.data,
                  project.data,
                  instance.data,
                  portal.data?.id,
                  'users'
                )}
              >
                <Button size="1">View All Users</Button>
              </Link>
            }
          >
            <PortalConsumerProfilesTable portalId={portal.data?.id} limit={50} />
          </Box>
        </>
      ))}
    </>
  );
};
