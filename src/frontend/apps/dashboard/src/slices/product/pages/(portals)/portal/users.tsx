import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, usePortal } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { PortalConsumerProfilesTable } from '../../../scenes/portals/usersTable';

export let PortalUsersPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.instanceId, params.portalId!);

  return (
    <>
      {renderWithLoader({ portal })(({ portal }) => (
        <PortalConsumerProfilesTable portalId={portal.data?.id} />
      ))}
    </>
  );
};
